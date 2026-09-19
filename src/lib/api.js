const SESSION_KEY = 'emailverify.session'

export function readStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export function readAuthCallback() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const type = params.get('type')
  const callbackError = params.get('error_description') || params.get('error')
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) {
    if (callbackError) window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
    return { session: null, type, error: callbackError }
  }

  const expiresIn = Number(params.get('expires_in') || 3600)
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    token_type: params.get('token_type') || 'bearer',
    auth_event: type || null,
  }
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
  return { session, type, error: null }
}

export function storeSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error?.message || 'Something went wrong. Please try again.')
    error.code = body.error?.code
    error.status = response.status
    throw error
  }
  return body
}

export async function apiRequest(path, { session, ...options } = {}) {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)

  const response = await fetch(`/api/v1${path}`, { ...options, headers })
  return parseResponse(response)
}

export function signUp(input) {
  return apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(input) })
}

export function signIn(input) {
  return apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(input) })
}

export function refreshSession(refreshToken) {
  return apiRequest('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) })
}

export function requestPasswordReset(email) {
  return apiRequest('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) })
}

export function updatePassword(session, password) {
  return apiRequest('/auth/password-update', { session, method: 'POST', body: JSON.stringify({ password, refreshToken: session.refresh_token }) })
}

export function updateProfile(session, input) {
  return apiRequest('/me', { session, method: 'PATCH', body: JSON.stringify(input) })
}
