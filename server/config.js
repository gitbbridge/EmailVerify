import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT || 8787),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  appUrl: process.env.APP_URL || process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  providerApiKey:
    process.env.EMAILABLE_API_KEY_TEST_KEY || process.env.EMAILABLE_API_KEY || '',
  providerBaseUrl: process.env.EMAILABLE_API_BASE_URL || 'https://api.emailable.com/v1',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || '',
  emailLogoUrl: process.env.EMAIL_LOGO_URL || 'https://emailcheckr.xyz/images/logos/emailverify-wordmark.png',
  adminEmail: process.env.ADMIN_EMAIL || '',
  signupFingerprintSecret:
    process.env.SIGNUP_FINGERPRINT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'local-development-only',
}

export function assertSupabaseConfigured() {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.supabaseServiceRoleKey) {
    const error = new Error('Supabase is not configured.')
    error.status = 503
    error.code = 'supabase_not_configured'
    throw error
  }
}

export function assertStripeConfigured() {
  if (!config.stripeSecretKey || !config.stripeWebhookSecret) {
    const error = new Error('Stripe is not configured.')
    error.status = 503
    error.code = 'stripe_not_configured'
    throw error
  }
}

export function assertProviderConfigured() {
  if (!config.providerApiKey) {
    const error = new Error('Verification provider is not configured.')
    error.status = 503
    error.code = 'provider_not_configured'
    throw error
  }
}
