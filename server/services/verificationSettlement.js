import { createHmac, randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { getSupabaseAdmin } from './supabase.js'
import { verifyEmail as verifyWithProvider } from './verificationProvider.js'

const validStates = new Set(['deliverable', 'risky', 'undeliverable', 'unknown'])

function fingerprintEmail(email) {
  return createHmac('sha256', config.signupFingerprintSecret)
    .update(email.trim().toLowerCase())
    .digest('hex')
}

function maskEmail(email) {
  const [local, domain] = email.trim().toLowerCase().split('@')
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, Math.min(8, local.length - 2)))}@${domain}`
}

function storedResponse(result, maskedEmail) {
  const { email: _email, user: _user, first_name: _firstName, last_name: _lastName, full_name: _fullName, ...signals } = result
  return { ...signals, email: maskedEmail }
}

async function callProviderWithRetry(input) {
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await verifyWithProvider(input)
    } catch (error) {
      lastError = error
      if (error.code !== 'verification_pending' || attempt === 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  throw lastError
}

export async function verifyAndSettle({ workspaceId, userId, apiKeyId = null, requestKey, input }) {
  const admin = getSupabaseAdmin()
  const requestId = randomUUID()
  const emailMasked = maskEmail(input.email)
  const { data: reservation, error: reservationError } = await admin.rpc('reserve_verification_credit', {
    p_request_id: requestId,
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_request_key: requestKey,
    p_email_hash: fingerprintEmail(input.email),
    p_email_masked: emailMasked,
  })

  if (reservationError) {
    const error = new Error(reservationError.message.includes('Insufficient') ? 'You do not have enough verification credits.' : 'Unable to reserve a verification credit.')
    error.status = reservationError.message.includes('Insufficient') ? 402 : 500
    error.code = reservationError.message.includes('Insufficient') ? 'insufficient_credits' : 'credit_reservation_failed'
    throw error
  }

  if (!reservation.created) {
    if (reservation.status === 'complete' && reservation.response) {
      return { ...reservation.response, request_id: reservation.id, credits_used: reservation.credits_used, cached: true }
    }
    const error = new Error(reservation.status === 'reserved' ? 'This verification request is already processing.' : 'This verification request previously failed.')
    error.status = 409
    error.code = reservation.status === 'reserved' ? 'verification_in_progress' : 'verification_retry_required'
    throw error
  }

  if (apiKeyId) {
    const { error: keyLinkError } = await admin.from('verification_requests').update({ api_key_id: apiKeyId }).eq('id', requestId)
    if (keyLinkError) throw keyLinkError
  }

  try {
    const result = await callProviderWithRetry(input)
    const state = validStates.has(result.state) ? result.state : 'unknown'
    const persisted = storedResponse({ ...result, state }, emailMasked)
    const { data: settlement, error: settlementError } = await admin.rpc('settle_verification_credit', {
      p_request_id: requestId,
      p_state: state,
      p_reason: result.reason || null,
      p_score: Number.isInteger(result.score) ? result.score : null,
      p_provider_request_id: result.id || result.request_id || null,
      p_response_data: persisted,
    })
    if (settlementError) throw settlementError

    return {
      ...result,
      state,
      request_id: requestId,
      credits_used: settlement.credits_used,
      refunded: settlement.credits_used === 0,
    }
  } catch (error) {
    await admin.rpc('fail_verification_credit', {
      p_request_id: requestId,
      p_error_code: error.code || 'verification_failed',
    })
    throw error
  }
}
