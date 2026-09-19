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
import { runBatchRetention } from './services/batchRetention.js'

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: config.clientOrigin }))
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRoutes)
app.use(express.json({ limit: '25mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'emailverify-api' })
})

app.use('/api/v1', accountRoutes)
app.use('/api/v1', teamRoutes)
app.use('/api/v1', apiKeyRoutes)
app.use('/api/v1', adminRoutes)
app.use('/api/v1', supportRoutes)
app.use('/api/v1', billingRoutes)
app.use('/api/v1', verificationRoutes)
app.use('/api/v1', batchUploadRoutes)
app.use(errorHandler)

app.listen(config.port, '127.0.0.1', () => {
  console.log(`EmailVerify API listening on http://127.0.0.1:${config.port}`)
})

const retentionTimer = setInterval(() => {
  runBatchRetention().catch((error) => console.error('Batch retention job failed:', error.message))
}, 6 * 60 * 60 * 1000)
retentionTimer.unref()
setTimeout(() => runBatchRetention().catch((error) => console.error('Batch retention job failed:', error.message)), 5000).unref()
