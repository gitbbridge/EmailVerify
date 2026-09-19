import { parentPort, workerData } from 'node:worker_threads'
import { parseListFile } from './listImport.js'

try {
  parentPort.postMessage({ result: await parseListFile({ ...workerData, buffer: Buffer.from(workerData.buffer) }) })
} catch (error) {
  parentPort.postMessage({ error: { message: error.message, status: error.status || 400 } })
}
