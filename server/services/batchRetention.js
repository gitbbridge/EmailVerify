import { config } from '../config.js'
import { sendBatchExpiryWarning } from './email.js'
import { getSupabaseAdmin } from './supabase.js'

export async function runBatchRetention() {
  const admin = getSupabaseAdmin()
  const { data: warnings, error: warningError } = await admin.rpc('claim_batch_retention_warnings')
  if (warningError) throw warningError

  for (const warning of warnings || []) {
    try {
      await sendBatchExpiryWarning({
        email: warning.owner_email,
        batchId: warning.batch_id,
        batchName: warning.batch_name,
        expiresAt: warning.expires_at,
        exportUrl: `${config.appUrl}/?batch=${warning.batch_id}&export=1`,
      })
    } catch (error) {
      await admin.rpc('release_batch_retention_warning', { p_batch_id: warning.batch_id })
      throw error
    }
  }

  const { data: expired, error: readError } = await admin.from('batches').select('id, export_path, submission_path, batch_chunks(export_path)').lte('expires_at', new Date().toISOString())
  if (readError) throw readError
  const paths = (expired || []).flatMap((batch) => [batch.export_path, ...(batch.batch_chunks || []).map((chunk) => chunk.export_path)]).filter(Boolean)
  if (paths.length) await admin.storage.from('batch-exports').remove(paths)
  const submissions = (expired || []).map((batch) => batch.submission_path).filter(Boolean)
  if (submissions.length) await admin.storage.from('batch-submissions').remove(submissions)
  if (expired?.length) {
    const { error: deleteError } = await admin.from('batches').delete().in('id', expired.map((batch) => batch.id))
    if (deleteError) throw deleteError
  }

  return { warnings: warnings?.length || 0, deleted: expired?.length || 0 }
}
