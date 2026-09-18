import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler } from './middleware/errorHandler.js'
import verificationRoutes from './routes/verification.js'

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: config.clientOrigin }))
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'emailverify-api' })
})

app.use('/api/v1', verificationRoutes)
app.use(errorHandler)

app.listen(config.port, '127.0.0.1', () => {
  console.log(`EmailVerify API listening on http://127.0.0.1:${config.port}`)
})

