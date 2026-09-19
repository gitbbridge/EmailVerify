import { createClient } from '@supabase/supabase-js'
import { config, assertSupabaseConfigured } from '../config.js'

let adminClient
let authClient

export function createSupabaseAuthClient() {
  assertSupabaseConfigured()
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function getSupabaseAdmin() {
  assertSupabaseConfigured()

  adminClient ??= createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return adminClient
}

export function getSupabaseAuth() {
  assertSupabaseConfigured()

  authClient ??= createSupabaseAuthClient()

  return authClient
}
