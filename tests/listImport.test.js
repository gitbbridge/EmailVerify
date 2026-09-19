import test from 'node:test'
import assert from 'node:assert/strict'
import writeXlsxFile from 'write-excel-file/node'
import { parseUpload } from '../server/services/parseUpload.js'
const file = (name, text) => ({ originalname: name, buffer: Buffer.from(text) })

test('CSV handles quotes, BOM, normalization and duplicates without substring extraction', async () => {
  const result = await parseUpload(file('leads.csv', '\ufeffName,Email\n"Smith, Pat",PAT@example.com\nOther,pat@example.com\nBad,hello@@example.com'))
  assert.deepEqual(result, { emails: ['pat@example.com'], duplicates: 1, ignored: 1 })
})
test('TXT accepts one address per line', async () => {
  assert.deepEqual((await parseUpload(file('leads.txt', 'a@example.com\r\nb@example.com'))).emails, ['a@example.com', 'b@example.com'])
})
test('XLSX reads actual workbook cells', async () => {
  const buffer = await writeXlsxFile([[{ value: 'Email', type: String }], [{ value: 'Person@example.com', type: String }]]).toBuffer()
  assert.deepEqual((await parseUpload({ originalname: 'leads.xlsx', buffer })).emails, ['person@example.com'])
})
test('rejects unsupported, malformed, empty and oversized files', async () => {
  for (const input of [file('bad.exe','a@example.com'), file('bad.xlsx','not a zip'), file('empty.csv','Email'), file('bad.csv','"unclosed'), file('big.txt',Buffer.alloc(10 * 1024 * 1024 + 1))]) {
    await assert.rejects(parseUpload(input), (error) => error.code === 'invalid_upload')
  }
})
