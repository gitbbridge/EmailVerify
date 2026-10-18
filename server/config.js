import 'dotenv/config'

const stripeTestSecretKey = process.env.STRIPE_TEST_SECRET_KEY || ''
const stripeTestWebhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET || ''
const appUrl = process.env.APP_URL || (process.env.RENDER === 'true' ? process.env.RENDER_EXTERNAL_URL : '') || process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173'

export const config = {
  host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS || 0),
  port: Number(process.env.PORT || 8787),
  clientOrigin: process.env.CLIENT_ORIGIN || appUrl,
  appUrl,
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  providerApiKey:
    process.env.EMAILABLE_API_KEY_TEST_KEY || process.env.EMAILABLE_API_KEY || '',
  providerBaseUrl: process.env.EMAILABLE_API_BASE_URL || 'https://api.emailable.com/v1',
  stripeTestSecretKey,
  stripeTestWebhookSecret,
  stripeSecretKey: stripeTestSecretKey || process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: stripeTestSecretKey ? stripeTestWebhookSecret : process.env.STRIPE_WEBHOOK_SECRET || '',
  stripeLiveEnabled: process.env.STRIPE_LIVE_ENABLED === 'true',
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

export function assertProductionConfigured(settings = config, env = process.env) {
  if (env.NODE_ENV !== 'production') return
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'EMAIL_FROM', 'ADMIN_EMAIL', 'SIGNUP_FINGERPRINT_SECRET'].filter((name) => !env[name])
  if (!env.EMAILABLE_API_KEY && !env.EMAILABLE_API_KEY_TEST_KEY) missing.push('EMAILABLE_API_KEY')
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`)
  const url = new URL(settings.appUrl)
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('APP_URL must be a public HTTPS origin.')
  if (settings.clientOrigin !== url.origin) throw new Error('CLIENT_ORIGIN must match APP_URL for the single-service deployment.')
  if (!Number.isInteger(settings.trustProxyHops) || settings.trustProxyHops < 0 || settings.trustProxyHops > 5) throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.')
  if (env.SIGNUP_FINGERPRINT_SECRET.length < 32) throw new Error('SIGNUP_FINGERPRINT_SECRET must contain at least 32 characters.')
  if (settings.stripeLiveEnabled && settings.stripeTestSecretKey) throw new Error('Remove the Stripe test overrides before enabling live payments.')
}

export function assertStripeConfigured() {
  if (config.stripeTestSecretKey && !/^(sk|rk)_test_/.test(config.stripeTestSecretKey)) {
    const error = new Error('STRIPE_TEST_SECRET_KEY must be a Stripe test secret key beginning with sk_test_ or rk_test_.')
    error.status = 503
    error.code = 'stripe_test_secret_invalid'
    throw error
  }
  if (!/^(sk|rk)_(test|live)_/.test(config.stripeSecretKey) || !/^whsec_/.test(config.stripeWebhookSecret)) {
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
