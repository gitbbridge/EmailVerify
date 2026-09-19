import { Worker } from 'node:worker_threads'
import { importError } from './listImport.js'

export function parseUpload(file) {
  if (!file) return Promise.reject(importError('Choose a file.'))
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./listImportWorker.js', import.meta.url), {
      workerData: { originalname: file.originalname, buffer: file.buffer },
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    })
    const timer = setTimeout(() => { reject(importError('This file took too long to read. Split it into smaller files.')); void worker.terminate() }, 15000)
    worker.once('message', (message) => { clearTimeout(timer); void worker.terminate(); message.error ? reject(importError(message.error.message, message.error.status)) : resolve(message.result) })
    worker.once('error', () => { clearTimeout(timer); reject(importError('This file could not be processed within the import limits.')) })
    worker.once('exit', (code) => { clearTimeout(timer); if (code !== 0) reject(importError('File processing stopped. Try a smaller file.')) })
  })
}
