import { createClient } from 'npm:@supabase/supabase-js@2.110.5'
import { Resend } from 'npm:resend@6.17.2'
import {
  assertAttachmentSize,
  assertZipFileSignature,
  buildAttachmentStoragePath,
  deriveWechatBillFilename,
  extractRecipientAlias,
  extractWechatBillDownloadUrl,
  normalizeZipContentType,
  sanitizeFilename,
  selectSingleZipAttachment,
  sha256Hex,
  type ResendAttachmentMetadata,
} from '../_shared/inbound-email.ts'

interface ReceivedEmailEvent {
  type: string
  data?: {
    email_id?: string
    to?: string[]
    subject?: string
    attachments?: ResendAttachmentMetadata[]
  }
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const resend = new Resend(requiredEnv('RESEND_API_KEY'))
  const payload = await request.text()
  let event: ReceivedEmailEvent
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get('svix-id') ?? '',
        timestamp: request.headers.get('svix-timestamp') ?? '',
        signature: request.headers.get('svix-signature') ?? '',
      },
      webhookSecret: requiredEnv('RESEND_WEBHOOK_SECRET'),
    }) as ReceivedEmailEvent
  } catch {
    return json({ error: 'invalid webhook signature' }, 401)
  }

  if (event.type !== 'email.received' || !event.data?.email_id) {
    return json({ status: 'ignored' })
  }

  const alias = extractRecipientAlias(
    event.data.to ?? [],
    requiredEnv('INBOUND_EMAIL_DOMAIN'),
  )
  if (!alias) return json({ status: 'ignored' })

  const admin = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data: inbox, error: inboxError } = await admin
    .from('bill_inboxes')
    .select('user_id')
    .eq('alias', alias)
    .maybeSingle()
  if (inboxError) throw inboxError
  if (!inbox) return json({ status: 'ignored' })

  const userId = String(inbox.user_id)
  const emailId = event.data.email_id
  const recordFailure = async (reason: string, filename = '账单附件异常.zip') => {
    const { error } = await admin.from('pending_bills').upsert({
      id: crypto.randomUUID(),
      user_id: userId,
      resend_email_id: emailId,
      filename: sanitizeFilename(filename),
      status: 'failed',
      failure_reason: reason.slice(0, 240),
      received_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    }, { onConflict: 'user_id,resend_email_id', ignoreDuplicates: true })
    if (error) throw error
  }

  const attachments = event.data.attachments ?? []
  let attachmentId: string
  let filename: string
  let contentType: string
  let bytes: Uint8Array

  if (attachments.length > 0) {
    let attachment: ResendAttachmentMetadata
    try {
      attachment = selectSingleZipAttachment(attachments)
    } catch (error) {
      await recordFailure(error instanceof Error ? error.message : '账单附件格式异常')
      return json({ status: 'rejected' })
    }

    const { data: attachmentData, error: attachmentError } = await resend.emails.receiving.attachments.get({
      id: attachment.id,
      emailId,
    })
    if (attachmentError || !attachmentData?.download_url) {
      throw new Error(attachmentError?.message ?? 'failed to retrieve attachment')
    }
    try {
      assertAttachmentSize(attachmentData.size)
    } catch (error) {
      await recordFailure(error instanceof Error ? error.message : '账单附件大小异常', attachment.filename)
      return json({ status: 'rejected' })
    }

    const download = await fetch(attachmentData.download_url)
    if (!download.ok) throw new Error(`attachment download failed: ${download.status}`)
    bytes = new Uint8Array(await download.arrayBuffer())
    attachmentId = attachment.id
    filename = sanitizeFilename(attachment.filename)
    contentType = normalizeZipContentType(attachmentData.content_type || attachment.content_type)
  } else {
    const { data: receivedEmail, error: receivedEmailError } = await resend.emails.receiving.get(emailId)
    if (receivedEmailError || !receivedEmail?.html) {
      throw new Error(receivedEmailError?.message ?? 'failed to retrieve received email content')
    }

    let downloadUrl: string
    try {
      downloadUrl = extractWechatBillDownloadUrl(receivedEmail.html)
    } catch (error) {
      await recordFailure(error instanceof Error ? error.message : '微信账单下载链接异常')
      return json({ status: 'rejected' })
    }
    const download = await fetch(downloadUrl)
    if (!download.ok) throw new Error(`wechat bill download failed: ${download.status}`)
    bytes = new Uint8Array(await download.arrayBuffer())
    attachmentId = `wechat-link:${emailId}`
    filename = sanitizeFilename(deriveWechatBillFilename(receivedEmail.html))
    contentType = normalizeZipContentType(download.headers.get('content-type'))
  }

  try {
    assertAttachmentSize(bytes.byteLength)
    assertZipFileSignature(bytes)
  } catch (error) {
    await recordFailure(error instanceof Error ? error.message : '账单附件大小异常', filename)
    return json({ status: 'rejected' })
  }

  const digest = await sha256Hex(bytes)
  const { data: duplicate, error: duplicateError } = await admin
    .from('pending_bills')
    .select('id')
    .eq('user_id', userId)
    .eq('content_sha256', digest)
    .maybeSingle()
  if (duplicateError) throw duplicateError
  if (duplicate) return json({ status: 'duplicate' })

  const billId = crypto.randomUUID()
  const storagePath = buildAttachmentStoragePath(userId, billId, filename)
  const { error: uploadError } = await admin.storage
    .from('bill-attachments')
    .upload(storagePath, bytes, { contentType, upsert: false })
  if (uploadError) {
    console.error('bill attachment upload failed', {
      message: uploadError.message,
      storagePath,
      contentType,
      sizeBytes: bytes.byteLength,
    })
    throw uploadError
  }

  const { error: insertError } = await admin.from('pending_bills').insert({
    id: billId,
    user_id: userId,
    resend_email_id: emailId,
    attachment_id: attachmentId,
    filename,
    content_type: contentType,
    size_bytes: bytes.byteLength,
    storage_path: storagePath,
    content_sha256: digest,
    status: 'pending',
    received_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
  })
  if (insertError) {
    await admin.storage.from('bill-attachments').remove([storagePath])
    if (insertError.code === '23505') return json({ status: 'duplicate' })
    throw insertError
  }

  return json({ status: 'queued' })
})
