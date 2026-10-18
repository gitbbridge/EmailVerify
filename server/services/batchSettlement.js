import { randomUUID, createHash } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'
import { createBatch, getBatch } from './verificationProvider.js'
import { assessBatchRisk } from './batchRisk.js'
import { sendBatchApprovalRequest } from './email.js'

function publicBatch(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    total: row.total,
    processed: row.processed,
    billable: row.billable,
    unknown: row.unknown,
    duplicate: row.duplicate,
    total_counts: row.total_counts,
    reason_counts: row.reason_counts,
    results_available: row.results_available ?? (row.total <= 1000),
    download_url: row.download_url,
    expires_at: row.expires_at,
    created_at: row.created_at,
    completed_at: row.completed_at,
    risk_rules: row.risk_rules || [],
    approval_requested_at: row.approval_requested_at,
    decision_reason: row.decision_reason,
  }
}

const resultStates = new Set(['deliverable', 'risky', 'undeliverable', 'unknown'])

function batchResultRows(batch, chunks) {
  let rowNumber = 0
  return chunks.flatMap((chunk) => (chunk.results || []).flatMap((result) => {
    if (!result?.email) return []
    rowNumber += 1
    const state = resultStates.has(result.state) ? result.state : 'unknown'
    return [{
      batch_id: batch.id,
      workspace_id: batch.workspace_id,
      row_number: rowNumber,
      email: String(result.email).trim().toLowerCase(),
      state,
      reason: result.reason || null,
      score: Number.isInteger(result.score) ? result.score : null,
      response_data: result,
    }]
  }))
}

async function beginBatchProcessing(batch, emails) {
  const admin = getSupabaseAdmin()
  const { error: reserveError } = await admin.rpc('reserve_existing_batch_credits', { p_batch_id: batch.id })
  if (reserveError) {
    const insufficient = reserveError.message.includes('Insufficient')
    const error = new Error(insufficient ? 'This workspace does not have enough credits for the approved list.' : 'Unable to reserve batch credits.')
    error.status = insufficient ? 402 : 500
    error.code = insufficient ? 'insufficient_credits' : 'batch_reservation_failed'
    throw error
  }

  try {
    const chunks = []
    for (let offset = 0; offset < emails.length; offset += 50000) {
      const chunkEmails = emails.slice(offset, offset + 50000)
      const provider = await createBatch({ emails: chunkEmails, retries: true })
      chunks.push({ batch_id: batch.id, chunk_number: chunks.length + 1, total: chunkEmails.length, provider_batch_id: provider.id, status: 'processing' })
    }
    const { error: chunkError } = await admin.from('batch_chunks').insert(chunks)
    if (chunkError) throw chunkError
    const { data, error } = await admin.from('batches').update({
      provider_batch_id: chunks[0].provider_batch_id,
      status: 'processing',
      approved_at: batch.approved_at || null,
    }).eq('id', batch.id).select().single()
    if (error) throw error
    return publicBatch(data)
  } catch (error) {
    await admin.rpc('release_batch_credits', { p_batch_id: batch.id, p_error_code: error.code || 'provider_batch_failed' })
    throw error
  }
}

export async function startBatch({ workspaceId, userId, networkHash, name, emails, requestKey = null }, { notifyApproval = sendBatchApprovalRequest } = {}) {
  const admin = getSupabaseAdmin()
  const uniqueEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()))]
  const requestHash = createHash('sha256').update(JSON.stringify({ name, emails: uniqueEmails })).digest('hex')
  const replay = async () => {
    if (!requestKey) return null
    const { data, error } = await admin.from('batches').select('*').eq('workspace_id', workspaceId).eq('request_key', requestKey).maybeSingle()
    if (error) throw error
    if (!data) return null
    if (data.request_hash !== requestHash) throw Object.assign(new Error('This upload key was already used for a different list.'), { status: 409, code: 'idempotency_conflict' })
    return { ...publicBatch(data), approval_required: data.status === 'approval_pending', replayed: true }
  }
  const existing = await replay()
  if (existing) return existing
  const batchId = randomUUID()
  const submissionPath = `${workspaceId}/${batchId}.json`
  const risk = await assessBatchRisk({ workspaceId, networkHash, total: uniqueEmails.length })
  const { error: uploadError } = await admin.storage.from('batch-submissions').upload(submissionPath, JSON.stringify(uniqueEmails), { contentType: 'application/json' })
  if (uploadError) throw uploadError
  const { data: batch, error: insertError } = await admin.from('batches').insert({
    id: batchId, workspace_id: workspaceId, user_id: userId, name, total: uniqueEmails.length,
    status: risk.requiresApproval ? 'approval_pending' : 'reserved', risk_rules: risk.rules,
    network_hash: networkHash, submission_path: submissionPath,
    request_key: requestKey, request_hash: requestKey ? requestHash : null,
    approval_requested_at: risk.requiresApproval ? new Date().toISOString() : null,
  }).select().single()
  if (insertError) {
    await admin.storage.from('batch-submissions').remove([submissionPath])
    if (insertError.code === '23505' && requestKey) {
      const winner = await replay()
      if (winner) return winner
    }
    throw insertError
  }
  if (risk.requiresApproval) {
    await admin.from('batch_approval_audit').insert({ batch_id: batchId, decision: 'requested', rule_codes: risk.rules, actor_user_id: userId })
    await notifyApproval({ batchId, batchName: name, total: uniqueEmails.length, rules: risk.rules }).catch(() => {})
    return { ...publicBatch(batch), duplicates_removed: emails.length - uniqueEmails.length, approval_required: true }
  }
  return { ...(await beginBatchProcessing(batch, uniqueEmails)), duplicates_removed: emails.length - uniqueEmails.length, approval_required: false }
}

export async function approveBatch({ batchId, adminUserId, reason }) {
  const admin = getSupabaseAdmin()
  const { data: batch, error } = await admin.from('batches').select('*').eq('id', batchId).eq('status', 'approval_pending').single()
  if (error) throw error
  const { data: file, error: downloadError } = await admin.storage.from('batch-submissions').download(batch.submission_path)
  if (downloadError) throw downloadError
  const emails = JSON.parse(await file.text())
  const now = new Date().toISOString()
  await admin.from('batches').update({ approved_at: now, approved_by: adminUserId, decision_reason: reason }).eq('id', batchId)
  await admin.from('batch_approval_audit').insert({ batch_id: batchId, decision: 'approved', rule_codes: batch.risk_rules, reason, actor_user_id: adminUserId })
  return beginBatchProcessing({ ...batch, approved_at: now }, emails)
}

export async function rejectBatch({ batchId, adminUserId, reason }) {
  const admin = getSupabaseAdmin()
  const { data: batch, error } = await admin.from('batches').select('*').eq('id', batchId).eq('status', 'approval_pending').single()
  if (error) throw error
  await admin.from('batches').update({ status: 'rejected', rejected_at: new Date().toISOString(), rejected_by: adminUserId, decision_reason: reason }).eq('id', batchId)
  await admin.from('batch_approval_audit').insert({ batch_id: batchId, decision: 'rejected', rule_codes: batch.risk_rules, reason, actor_user_id: adminUserId })
  if (batch.submission_path) await admin.storage.from('batch-submissions').remove([batch.submission_path])
  return { rejected: true }
}

export async function refreshBatch({ workspaceId, batchId }) {
  const admin = getSupabaseAdmin()
  const { data: row, error } = await admin.from('batches').select('*').eq('id', batchId).eq('workspace_id', workspaceId).single()
  if (error) throw error
  if (row.status !== 'processing') return publicBatch(row)

  const { data: chunks, error: chunkReadError } = await admin.from('batch_chunks').select('*').eq('batch_id', batchId).order('chunk_number')
  if (chunkReadError) throw chunkReadError
  const refreshed = []
  for (const chunk of chunks) {
    if (chunk.status === 'complete') { refreshed.push(chunk); continue }
    const provider = await getBatch(chunk.provider_batch_id)
    const counts = provider.total_counts || {}
    const processed = Number(counts.processed ?? provider.processed ?? 0)
    const total = Number(counts.total ?? provider.total ?? chunk.total)
    const complete = processed >= total || /completed/i.test(provider.message || '')
    let exportPath = chunk.export_path
    if (complete && provider.download_file) {
      const archive = await fetch(provider.download_file)
      if (!archive.ok) throw new Error('Unable to archive the completed batch export.')
      exportPath = `${workspaceId}/${batchId}-${chunk.chunk_number}.zip`
      const { error: uploadError } = await admin.storage.from('batch-exports').upload(exportPath, await archive.arrayBuffer(), { contentType: archive.headers.get('content-type') || 'application/zip', upsert: true })
      if (uploadError) throw uploadError
    }
    const update = { processed, status: complete ? 'complete' : 'processing', total_counts: counts, reason_counts: provider.reason_counts || {}, results: provider.emails || null, export_path: exportPath }
    const { data: updated, error: chunkUpdateError } = await admin.from('batch_chunks').update(update).eq('id', chunk.id).select().single()
    if (chunkUpdateError) throw chunkUpdateError
    refreshed.push(updated)
  }
  const processed = refreshed.reduce((sum, chunk) => sum + chunk.processed, 0)
  if (refreshed.some((chunk) => chunk.status !== 'complete')) {
    await admin.from('batches').update({ processed }).eq('id', batchId)
    return { ...publicBatch(row), processed, status: 'processing' }
  }
  const sumCount = (key) => refreshed.reduce((sum, chunk) => sum + Number(chunk.total_counts?.[key] || 0), 0)
  const counts = { deliverable: sumCount('deliverable'), risky: sumCount('risky'), undeliverable: sumCount('undeliverable'), unknown: sumCount('unknown'), duplicate: sumCount('duplicate'), processed, total: row.total }
  const reasons = refreshed.reduce((all, chunk) => { for (const [key, value] of Object.entries(chunk.reason_counts || {})) all[key] = (all[key] || 0) + Number(value); return all }, {})
  const resultRows = batchResultRows(row, refreshed)
  if (resultRows.length) {
    const { error: resultError } = await admin.from('batch_results').upsert(resultRows, { onConflict: 'batch_id,row_number' })
    if (resultError) throw resultError
  }
  const results = null
  const unknown = counts.unknown
  const duplicate = counts.duplicate
  const { error: settlementError } = await admin.rpc('settle_batch_credits', {
    p_batch_id: batchId,
    p_processed: processed,
    p_unknown: unknown,
    p_duplicate: duplicate,
    p_counts: counts,
    p_reasons: reasons,
    p_results: results,
    p_download_url: null,
  })
  if (settlementError) throw settlementError
  const { data: completeRow, error: readError } = await admin.from('batches').select('*').eq('id', batchId).single()
  if (readError) throw readError
  return publicBatch(completeRow)
}

export async function listBatches(workspaceId) {
  const { data, error } = await getSupabaseAdmin().from('batches').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return data.map(publicBatch)
}
