import { createClient } from 'npm:@supabase/supabase-js@2.110.5'
import { isCleanupRequestAuthorized } from '../_shared/cleanup-auth.ts'

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
  if (!isCleanupRequestAuthorized(
    request.headers.get('x-cleanup-secret') ?? '',
    requiredEnv('BILL_CLEANUP_SECRET'),
  )) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data: rows, error: rowsError } = await admin
    .from('pending_bills')
    .select('id,storage_path')
    .in('status', ['pending', 'failed'])
    .lt('expires_at', new Date().toISOString())
    .limit(1000)
  if (rowsError) throw rowsError
  if (!rows?.length) return json({ deleted: 0 })

  const paths = rows
    .map(row => row.storage_path)
    .filter((path): path is string => typeof path === 'string' && path.length > 0)
  if (paths.length > 0) {
    const { error } = await admin.storage.from('bill-attachments').remove(paths)
    if (error) throw error
  }
  const { error: deleteError } = await admin
    .from('pending_bills')
    .delete()
    .in('id', rows.map(row => row.id))
  if (deleteError) throw deleteError
  return json({ deleted: rows.length })
})
