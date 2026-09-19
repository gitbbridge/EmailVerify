import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { getCreditBalance } from '../services/verificationProvider.js'
import { verifyAndSettle } from '../services/verificationSettlement.js'
import { approveBatch, listBatches, refreshBatch, rejectBatch, startBatch } from '../services/batchSettlement.js'
import { getSupabaseAdmin } from '../services/supabase.js'
import { requireAuth, requireSystemAdmin, requireWorkspace } from '../middleware/auth.js'
import { getSignupFingerprint } from '../services/signupFingerprint.js'
import { authenticateVerificationRequest } from '../services/apiKeys.js'

const router = Router()

const responseFields = [
  'accept_all', 'birth_year', 'did_you_mean', 'disposable', 'domain', 'email',
  'first_name', 'free', 'full_name', 'gender', 'last_name', 'mailbox_full',
  'mx_record', 'no_reply', 'reason', 'role', 'score', 'smtp_provider', 'state',
  'tag', 'user',
]

const verifySchema = z.object({
  email: z.email(),
  smtp: z.boolean().default(true),
  accept_all: z.boolean().default(false),
  timeout: z.coerce.number().int().min(2).max(10).default(5),
})

const batchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  emails: z.array(z.email()).min(1).max(250000),
})

router.post('/verify', async (request, response, next) => {
  try {
    const input = verifySchema.parse(request.body)
    const requestKey = z.string().min(8).max(128).parse(request.get('idempotency-key') || randomUUID())
    const principal = await authenticateVerificationRequest(request)
    response.json(await verifyAndSettle({
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      apiKeyId: principal.apiKeyId,
      requestKey,
      input,
    }))
  } catch (error) {
    next(error)
  }
})

router.get('/verifications', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit)
    const { data, error } = await getSupabaseAdmin()
      .from('verification_requests')
      .select('id, email_masked, state, reason, score, status, credits_used, created_at, completed_at')
      .eq('workspace_id', request.workspace.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    response.json({ items: data })
  } catch (error) {
    next(error)
  }
})

router.post('/batches', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const input = batchSchema.parse(request.body)
    const { networkHash } = getSignupFingerprint(request)
    response.status(202).json(await startBatch({ workspaceId: request.workspace.id, userId: request.auth.user.id, networkHash, ...input }))
  } catch (error) {
    next(error)
  }
})

router.get('/batches/:id', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    response.json(await refreshBatch({ workspaceId: request.workspace.id, batchId: z.uuid().parse(request.params.id) }))
  } catch (error) {
    next(error)
  }
})

router.get('/batches/:id/results', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const id = z.uuid().parse(request.params.id)
    const page = z.coerce.number().int().min(1).max(10000).default(1).parse(request.query.page)
    const pageSize = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.pageSize)
    const state = z.enum(['all', 'deliverable', 'risky', 'undeliverable', 'unknown']).default('all').parse(request.query.state || 'all')
    const search = z.string().trim().max(120).default('').parse(request.query.search || '')
    const admin = getSupabaseAdmin()
    let query = admin.from('batch_results')
      .select('id,row_number,email,state,reason,score,created_at', { count: 'exact' })
      .eq('batch_id', id)
      .eq('workspace_id', request.workspace.id)
    if (state !== 'all') query = query.eq('state', state)
    if (search) query = query.ilike('email', `%${search.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
    const from = (page - 1) * pageSize
    const { data, count, error } = await query.order('row_number').range(from, from + pageSize - 1)
    if (error) throw error
    response.json({ items: data || [], page, pageSize, total: count || 0, resultsAvailable: (count || 0) > 0 })
  } catch (error) {
    next(error)
  }
})

router.get('/batches/:id/export', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const id = z.uuid().parse(request.params.id)
    const admin = getSupabaseAdmin()
    const { data: batch, error } = await admin.from('batches').select('name, status, results, export_path').eq('id', id).eq('workspace_id', request.workspace.id).single()
    if (error) throw error
    if (batch.status !== 'complete') {
      const pending = new Error('This batch is not ready to export.')
      pending.status = 409
      pending.code = 'batch_not_complete'
      throw pending
    }
    const { data: chunks, error: chunkError } = await admin.from('batch_chunks').select('export_path').eq('batch_id', id).not('export_path', 'is', null).order('chunk_number')
    if (chunkError) throw chunkError
    const paths = [batch.export_path, ...(chunks || []).map((chunk) => chunk.export_path)].filter(Boolean)
    if (paths.length) {
      const { data, error: signedError } = await admin.storage.from('batch-exports').createSignedUrls(paths, 60)
      if (signedError) throw signedError
      return response.json({ downloadUrl: data[0]?.signedUrl, downloadUrls: data.map((item) => item.signedUrl) })
    }
    const rows = batch.results || []
    const columns = ['email', 'state', 'reason', 'score', 'disposable', 'role', 'free', 'accept_all']
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\r\n')
    response.setHeader('Content-Type', 'text/csv; charset=utf-8')
    response.setHeader('Content-Disposition', `attachment; filename="${batch.name.replaceAll('"', '')}-results.csv"`)
    return response.send(csv)
  } catch (error) {
    next(error)
  }
})

const decisionSchema = z.object({ reason: z.string().trim().min(10).max(500) })

router.get('/admin/batch-approvals', requireAuth, requireSystemAdmin, async (_request, response, next) => {
  try {
    const { data, error } = await getSupabaseAdmin().from('batches').select('id,name,total,risk_rules,approval_requested_at,workspace_id,workspaces(name)').eq('status', 'approval_pending').order('approval_requested_at')
    if (error) throw error
    response.json({ items: data })
  } catch (error) { next(error) }
})

router.post('/admin/batch-approvals/:id/approve', requireAuth, requireSystemAdmin, async (request, response, next) => {
  try {
    const { reason } = decisionSchema.parse(request.body)
    response.json(await approveBatch({ batchId: z.uuid().parse(request.params.id), adminUserId: request.auth.user.id, reason }))
  } catch (error) { next(error) }
})

router.post('/admin/batch-approvals/:id/reject', requireAuth, requireSystemAdmin, async (request, response, next) => {
  try {
    const { reason } = decisionSchema.parse(request.body)
    response.json(await rejectBatch({ batchId: z.uuid().parse(request.params.id), adminUserId: request.auth.user.id, reason }))
  } catch (error) { next(error) }
})

router.get('/batches', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    response.json({ items: await listBatches(request.workspace.id) })
  } catch (error) {
    next(error)
  }
})

router.get('/provider/credits', requireAuth, requireSystemAdmin, async (_request, response, next) => {
  try {
    response.json(await getCreditBalance())
  } catch (error) {
    next(error)
  }
})

export default router
