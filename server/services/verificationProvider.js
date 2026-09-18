import { config, assertProviderConfigured } from '../config.js'

async function providerRequest(path, options = {}) {
  assertProviderConfigured()

  const response = await fetch(`${config.providerBaseUrl}${path}`, options)
  const body = await response.json().catch(() => ({ message: 'Invalid provider response.' }))

  if (!response.ok) {
    const error = new Error(body.message || 'Verification request failed.')
    error.status = response.status === 249 ? 202 : response.status
    error.code = response.status === 249 ? 'verification_pending' : 'provider_request_failed'
    error.details = body
    throw error
  }

  return body
}

export function verifyEmail({ email, smtp, accept_all, timeout }) {
  const params = new URLSearchParams({
    email,
    smtp: String(smtp),
    accept_all: String(accept_all),
    timeout: String(timeout),
    api_key: config.providerApiKey,
  })

  return providerRequest(`/verify?${params.toString()}`)
}

export function createBatch({ emails, url, response_fields, retries }) {
  return providerRequest('/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emails,
      url,
      response_fields: response_fields?.join(','),
      retries,
      api_key: config.providerApiKey,
    }),
  })
}

export function getBatch(id) {
  const params = new URLSearchParams({ id, api_key: config.providerApiKey })
  return providerRequest(`/batch?${params.toString()}`)
}

export async function getCreditBalance() {
  const params = new URLSearchParams({ api_key: config.providerApiKey })
  const account = await providerRequest(`/account?${params.toString()}`)
  return { available_credits: account.available_credits }
}

