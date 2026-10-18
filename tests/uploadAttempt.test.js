import test from 'node:test'
import assert from 'node:assert/strict'
import { getUploadAttempt, finishUploadAttempt } from '../src/lib/uploadAttempt.js'

test('pending imports survive remounts, are workspace scoped, and clear only on matching success', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
  const first = getUploadAttempt('one', 'hash', storage)
  assert.equal(getUploadAttempt('one', 'hash', storage).key, first.key)
  assert.notEqual(getUploadAttempt('two', 'hash', storage).key, first.key)
  finishUploadAttempt({ ...first, key: 'stale' }, storage)
  assert.equal(getUploadAttempt('one', 'hash', storage).key, first.key)
  finishUploadAttempt(first, storage)
  assert.notEqual(getUploadAttempt('one', 'hash', storage).key, first.key)
})

test('missing workspace and unavailable storage fail before submitting', () => {
  assert.throws(() => getUploadAttempt(null, 'hash', {}), /workspace is still loading/)
  assert.throws(() => getUploadAttempt('one', 'hash', { getItem() { throw new Error('denied') } }), /storage is unavailable/)
})
