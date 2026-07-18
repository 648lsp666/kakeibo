export const MAX_BILL_ATTACHMENT_BYTES = 20 * 1024 * 1024

export interface ResendAttachmentMetadata {
  id: string
  filename: string
  content_type?: string | null
}

const WECHAT_BILL_DOWNLOAD_HOST = 'tenpay.wechatpay.cn'
const WECHAT_BILL_DOWNLOAD_PATH = '/userroll/userbilldownload/downloadfilefromemail'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function extractRecipientAlias(recipients: string[], receivingDomain: string): string | null {
  const domain = receivingDomain.trim().toLowerCase().replace(/^@/, '')
  if (!domain) return null
  const pattern = new RegExp(`(?:^|<)([0-9a-f]{20})@${escapeRegExp(domain)}(?:>|$)`, 'i')
  for (const recipient of recipients) {
    const match = recipient.trim().match(pattern)
    if (match) return match[1].toLowerCase()
  }
  return null
}

export function selectSingleZipAttachment(
  attachments: ResendAttachmentMetadata[],
): ResendAttachmentMetadata {
  const zipAttachments = attachments.filter(attachment => {
    const contentType = attachment.content_type?.toLowerCase() ?? ''
    return attachment.filename.toLowerCase().endsWith('.zip')
      || contentType === 'application/zip'
      || contentType === 'application/x-zip-compressed'
  })
  if (zipAttachments.length === 0) throw new Error('未找到 ZIP 账单附件')
  if (zipAttachments.length > 1) throw new Error('邮件包含多个 ZIP 附件')
  return zipAttachments[0]
}

/** Extracts the one-time ZIP download URL from a genuine WeChat bill email. */
export function extractWechatBillDownloadUrl(html: string): string {
  const anchors = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)
  for (const anchor of anchors) {
    const [, attributes, content] = anchor
    const label = content.replace(/<[^>]*>/g, '').replace(/\s+/g, '')
    if (!label.includes('点击下载')) continue

    const href = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
    const rawUrl = href?.[1] ?? href?.[2] ?? href?.[3]
    if (!rawUrl) throw new Error('微信账单下载链接缺失')

    let url: URL
    try {
      url = new URL(rawUrl.replace(/&amp;/gi, '&'))
    } catch {
      throw new Error('微信账单下载链接格式无效')
    }
    if (
      url.protocol !== 'https:'
      || url.hostname !== WECHAT_BILL_DOWNLOAD_HOST
      || url.port
      || url.username
      || url.password
      || url.pathname !== WECHAT_BILL_DOWNLOAD_PATH
      || !url.searchParams.get('encrypted_file_data')
    ) {
      throw new Error('微信账单下载链接不可信')
    }
    return url.toString()
  }
  throw new Error('未找到微信账单下载链接')
}

export function deriveWechatBillFilename(html: string): string {
  const period = html.match(/微信支付账单流水文件\s*[（(](\d{8}-\d{8})[）)]/)
  return period ? `微信支付账单(${period[1]}).zip` : '微信支付账单.zip'
}

export function assertZipFileSignature(bytes: Uint8Array): void {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('下载内容不是 ZIP 账单文件')
  }
}

export function sanitizeFilename(filename: string): string {
  const safe = filename
    .normalize('NFKC')
    .replace(/[\s/\\:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 160)
  return safe || 'bill.zip'
}

export function buildAttachmentStoragePath(
  userId: string,
  billId: string,
  _displayFilename?: string,
): string {
  return `${userId}/${billId}/bill.zip`
}

export function assertAttachmentSize(size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error('账单附件为空')
  if (size > MAX_BILL_ATTACHMENT_BYTES) throw new Error('账单附件超过 20 MB')
}

export function normalizeZipContentType(contentType: string | null | undefined): string {
  const normalized = contentType?.toLowerCase().trim()
  if (normalized === 'application/x-zip-compressed' || normalized === 'application/octet-stream') {
    return normalized
  }
  return 'application/zip'
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('')
}
