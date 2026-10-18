const PREFIX = 'emailverify.upload.'

export function getUploadAttempt(workspaceId, fingerprint, storage = sessionStorage) {
  if (!workspaceId) throw new Error('Your workspace is still loading. Please try again shortly.')
  const storageKey = `${PREFIX}${workspaceId}.${fingerprint}`
  try {
    const existing = storage.getItem(storageKey)
    if (existing && /^[a-f0-9-]{36}$/.test(existing)) return { storageKey, key: existing }
    const key = crypto.randomUUID()
    storage.setItem(storageKey, key)
    return { storageKey, key }
  } catch {
    throw new Error('Browser storage is unavailable. Enable site storage before uploading so interrupted imports can be recovered.')
  }
}

export function finishUploadAttempt(attempt, storage = sessionStorage) {
  // A stale response must not clear a newer attempt for the same file.
  try { if (storage.getItem(attempt.storageKey) === attempt.key) storage.removeItem(attempt.storageKey) } catch { /* Retaining a key is safe: the server returns the existing batch. */ }
}
