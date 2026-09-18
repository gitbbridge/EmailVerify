import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT || 8787),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  providerApiKey:
    process.env.EMAILABLE_API_KEY_TEST_KEY || process.env.EMAILABLE_API_KEY || '',
  providerBaseUrl: process.env.EMAILABLE_API_BASE_URL || 'https://api.emailable.com/v1',
}

export function assertProviderConfigured() {
  if (!config.providerApiKey) {
    const error = new Error('Verification provider is not configured.')
    error.status = 503
    error.code = 'provider_not_configured'
    throw error
  }
}
