import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler } from './middleware/errorHandler.js'
import accountRoutes from './routes/account.js'
import teamRoutes from './routes/team.js'
import apiKeyRoutes from './routes/apiKeys.js'
import adminRoutes from './routes/admin.js'
import supportRoutes from './routes/support.js'
import billingRoutes from './routes/billing.js'
import stripeWebhookRoutes from './routes/stripeWebhook.js'
import verificationRoutes from './routes/verification.js'
import batchUploadRoutes from './routes/batchUpload.js'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))

export function createApp({ serveFrontend = process.env.NODE_ENV === 'production', distPath = dist, trustProxyHops = config.trustProxyHops } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', trustProxyHops)
  app.use(helmet({ strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false }))
  app.use(cors({ origin: config.clientOrigin }))
  app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRoutes)
  app.use(express.json({ limit: '25mb' }))
  app.get('/api/health', (_request, response) => {
    response.set('Cache-Control', 'no-store').json({ status: 'ok', service: 'emailverify-api' })
  })
  for (const router of [accountRoutes, teamRoutes, apiKeyRoutes, adminRoutes, supportRoutes, billingRoutes, verificationRoutes, batchUploadRoutes]) app.use('/api/v1', router)
  app.use('/api', (_request, response) => response.status(404).json({ error: { code: 'not_found', message: 'API endpoint not found.' } }))
  if (serveFrontend) {
    if (!existsSync(path.join(distPath, 'index.html'))) throw new Error('Frontend build is missing. Run npm run build before npm start.')
    app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y', index: false }))
    app.use('/assets', (_request, response) => response.sendStatus(404))
    app.use(express.static(distPath, { index: false, maxAge: '1h', dotfiles: 'deny' }))
    app.get('/{*page}', (request, response) => {
      if (path.extname(request.path) || request.path.split('/').some((part) => part.startsWith('.'))) return response.sendStatus(404)
      response.set('Cache-Control', 'no-store').sendFile(path.join(distPath, 'index.html'))
    })
  }
  app.use(errorHandler)
  return app
}
