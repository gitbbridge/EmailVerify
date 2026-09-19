import { getSupabaseAdmin, getSupabaseAuth } from '../services/supabase.js'

function unauthorized(message = 'Authentication is required.') {
  const error = new Error(message)
  error.status = 401
  error.code = 'unauthorized'
  return error
}

export async function requireAuth(request, _response, next) {
  try {
    const header = request.get('authorization') || ''
    const [scheme, token] = header.split(' ')

    if (scheme !== 'Bearer' || !token) throw unauthorized()

    const { data, error } = await getSupabaseAuth().auth.getUser(token)
    if (error || !data.user) throw unauthorized('The session is invalid or expired.')

    request.auth = { token, user: data.user }
    next()
  } catch (error) {
    next(error)
  }
}

export async function requireWorkspace(request, _response, next) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('workspace_members')
      .select('workspace_id, role, workspaces(id, name, status)')
      .eq('user_id', request.auth.user.id)
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      const missing = new Error('Create a workspace before using this endpoint.')
      missing.status = 409
      missing.code = 'workspace_required'
      throw missing
    }
    if (data.workspaces?.status !== 'active') {
      const suspended = new Error('This workspace is not active.')
      suspended.status = 403
      suspended.code = 'workspace_inactive'
      throw suspended
    }

    request.workspace = {
      id: data.workspace_id,
      name: data.workspaces.name,
      role: data.role,
    }
    next()
  } catch (error) {
    next(error)
  }
}

export function requireSystemAdmin(request, _response, next) {
  getSupabaseAdmin()
    .from('profiles')
    .select('system_role')
    .eq('user_id', request.auth.user.id)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error
      if (data?.system_role !== 'admin') {
        const forbidden = new Error('Administrator access is required.')
        forbidden.status = 403
        forbidden.code = 'forbidden'
        throw forbidden
      }
      next()
    })
    .catch(next)
}
