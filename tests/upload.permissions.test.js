import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import uploadRoutes from '../server/routes/batchUpload.js'
import { errorHandler } from '../server/middleware/errorHandler.js'

test('unauthenticated multipart uploads are rejected before parsing or storage', async () => {
  const app = express()
  app.use('/api/v1', uploadRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const body = new FormData()
    body.append('file', new Blob(['a@example.com']), 'leads.txt')
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/batches/upload`, { method: 'POST', body })
    assert.equal(response.status, 401)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
