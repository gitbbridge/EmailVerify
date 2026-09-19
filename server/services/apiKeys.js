import { createHmac, randomBytes } from 'node:crypto'
import { config } from '../config.js'
import { getSupabaseAdmin, getSupabaseAuth } from './supabase.js'

const windows = new Map()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 60

export function hashApiKey(secret) {
  return createHmac('sha256', config.signupFingerprintSecret).update(secret).digest('hex')
}

export function generateApiKey(environment = 'live') {
  const secret = `ev_${environment}_${randomBytes(24).toString('base64url')}`
  return { secret, prefix: secret.slice(0, 18), secretHash: hashApiKey(secret) }
}

function enforceRateLimit(id) {
  const now = Date.now()
  const current = windows.get(id)
  if (!current || current.resetAt <= now) {
    windows.set(id, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  current.count += 1
  if (current.count > MAX_REQUESTS) {
    const error = new Error('API rate limit exceeded. Try again in one minute.')
    error.status = 429
    error.code = 'rate_limit_exceeded'
    throw error
  }
}

export async function authenticateVerificationRequest(request) {
  const header = request.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    const error = new Error('Authentication is required.')
    error.status = 401
    error.code = 'unauthorized'
    throw error
  }

  if (token.startsWith('ev_live_') || token.startsWith('ev_test_')) {
    const admin = getSupabaseAdmin()
    const { data: apiKey, error } = await admin.from('api_keys')
      .select('id,workspace_id,environment,revoked_at,workspaces(status)')
      .eq('secret_hash', hashApiKey(token)).maybeSingle()
    if (error) throw error
    if (!apiKey || apiKey.revoked_at || apiKey.workspaces?.status !== 'active') {
      const invalid = new Error('The API key is invalid or revoked.')
      invalid.status = 401
      invalid.code = 'invalid_api_key'
      throw invalid
    }
    enforceRateLimit(apiKey.id)
    await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKey.id)
    return { workspaceId: apiKey.workspace_id, userId: null, apiKeyId: apiKey.id, environment: apiKey.environment }
  }

  const { data, error } = await getSupabaseAuth().auth.getUser(token)
  if (error || !data.user) {
    const invalid = new Error('The session is invalid or expired.')
    invalid.status = 401
    invalid.code = 'unauthorized'
    throw invalid
  }
  const { data: membership, error: membershipError } = await getSupabaseAdmin().from('workspace_members')
    .select('workspace_id,workspaces(status)').eq('user_id', data.user.id).limit(1).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership || membership.workspaces?.status !== 'active') {
    const missing = new Error('An active workspace is required.')
    missing.status = 403
    missing.code = 'workspace_required'
    throw missing
  }
  return { workspaceId: membership.workspace_id, userId: data.user.id, apiKeyId: null, environment: 'live' }
}
