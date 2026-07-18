import { createClient } from 'npm:@supabase/supabase-js@2.110.5'
import { parseManagePendingBillAction } from '../_shared/manage-pending-bill.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'content-type': 'application/json' },
})

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authorization = request.headers.get('authorization')
  if (!authorization) return json({ error: 'authentication required' }, 401)

  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const userClient = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'authentication required' }, 401)

  let action
  try {
    action = parseManagePendingBillAction(await request.json())
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '请求参数无效' }, 400)
  }

  const admin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const userId = authData.user.id

  const removeObjects = async (paths: Array<string | null>) => {
    const storagePaths = paths.filter((path): path is string => Boolean(path))
    if (storagePaths.length === 0) return
    const { error } = await admin.storage.from('bill-attachments').remove(storagePaths)
    if (error) throw error
  }

  if (action.action === 'disable') {
    const { data: rows, error: rowsError } = await admin
      .from('pending_bills')
      .select('storage_path')
      .eq('user_id', userId)
    if (rowsError) throw rowsError
    await removeObjects((rows ?? []).map(row => row.storage_path))
    const { error: billsDeleteError } = await admin
      .from('pending_bills')
      .delete()
      .eq('user_id', userId)
    if (billsDeleteError) throw billsDeleteError
    const { error: inboxDeleteError } = await admin
      .from('bill_inboxes')
      .delete()
      .eq('user_id', userId)
    if (inboxDeleteError) throw inboxDeleteError
    return json({ ok: true })
  }

  const { data: bill, error: billError } = await admin
    .from('pending_bills')
    .select('id,storage_path,status')
    .eq('id', action.billId)
    .eq('user_id', userId)
    .maybeSingle()
  if (billError) throw billError
  if (!bill) return json({ error: '账单不存在或已处理' }, 404)

  await removeObjects([bill.storage_path])

  if (action.action === 'delete') {
    const { error } = await admin
      .from('pending_bills')
      .delete()
      .eq('id', action.billId)
      .eq('user_id', userId)
    if (error) throw error
    return json({ ok: true })
  }

  if (bill.status !== 'pending') return json({ error: '账单不存在或已处理' }, 409)
  const { data, error } = await admin
    .from('pending_bills')
    .update({
      status: 'completed',
      storage_path: null,
      source: action.source,
      statement_period: action.statementPeriod,
      imported_count: action.importedCount,
      completed_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      failure_reason: null,
    })
    .eq('id', action.billId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) return json({ error: '账单不存在或已处理' }, 409)
  return json({ ok: true })
})
