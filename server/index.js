import { config, assertProductionConfigured } from './config.js'
import { createApp } from './app.js'
import { runBatchRetention } from './services/batchRetention.js'

assertProductionConfigured()
const server = createApp().listen(config.port, config.host, () => {
  console.log(`EmailVerify listening on ${config.host}:${config.port}`)
})
server.requestTimeout = 120_000

const retentionTimer = setInterval(() => {
  runBatchRetention().catch((error) => console.error('Batch retention job failed:', error.message))
}, 6 * 60 * 60 * 1000)
retentionTimer.unref()
const initialRetention = setTimeout(() => runBatchRetention().catch((error) => console.error('Batch retention job failed:', error.message)), 5000)
initialRetention.unref()

function shutdown() {
  clearInterval(retentionTimer)
  clearTimeout(initialRetention)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
