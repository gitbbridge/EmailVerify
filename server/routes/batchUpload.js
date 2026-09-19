import { Router } from 'express'
import multer from 'multer'
import { requireAuth, requireWorkspace } from '../middleware/auth.js'
import { MAX_UPLOAD_BYTES, importError } from '../services/listImport.js'
import { parseUpload } from '../services/parseUpload.js'
import { startBatch } from '../services/batchSettlement.js'
import { getSignupFingerprint } from '../services/signupFingerprint.js'

const router = Router()
let activeUploads = 0
const uploadingWorkspaces = new Set()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 1 } }).single('file')
router.post('/batches/upload', requireAuth, requireWorkspace, (request, response, next) => {
  if (activeUploads >= 2 || uploadingWorkspaces.has(request.workspace.id)) return next(importError('An import is already running. Try again shortly.', 429))
  activeUploads++
  uploadingWorkspaces.add(request.workspace.id)
  upload(request, response, async (error) => {
    try {
      if (error) throw importError(error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 10 MB or smaller.' : 'Upload exactly one file.', error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      const parsed = await parseUpload(request.file)
      const name = request.file.originalname.replace(/\.[^.]+$/, '').trim().slice(0, 120) || 'Imported list'
      const { networkHash } = getSignupFingerprint(request)
      const batch = await startBatch({ workspaceId: request.workspace.id, userId: request.auth.user.id, networkHash, name, emails: parsed.emails })
      response.status(202).json({ ...batch, duplicates_removed: parsed.duplicates, ignored_cells: parsed.ignored })
    } catch (failure) { next(failure) }
    finally { activeUploads--; uploadingWorkspaces.delete(request.workspace.id) }
  })
})
export default router
