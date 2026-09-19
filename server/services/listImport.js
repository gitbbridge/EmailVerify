import { extname } from 'node:path'
import { parse } from 'csv-parse/sync'
import readXlsxFile from 'read-excel-file/node'
import { z } from 'zod'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const emailSchema = z.email()
export function importError(message, status = 400) {
  return Object.assign(new Error(message), { status, code: 'invalid_upload' })
}

export async function parseListFile(file) {
  if (!file?.buffer?.length) throw importError('Choose a nonempty CSV, TXT, or XLSX file.')
  if (file.buffer.length > MAX_UPLOAD_BYTES) throw importError('Files must be 10 MB or smaller.', 413)
  const extension = extname(file.originalname).toLowerCase()
  if (!['.csv', '.txt', '.xlsx'].includes(extension)) throw importError('Choose a CSV, TXT, or XLSX file.')
  let sheets
  try {
    if (extension === '.xlsx') sheets = (await readXlsxFile(file.buffer)).map((sheet) => sheet.data)
    else {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer)
      if (text.includes('\0')) throw new Error('Binary content')
      sheets = [extension === '.csv' ? parse(text, { bom: true, skip_empty_lines: true, relax_column_count: true, max_record_size: 65536 }) : text.split(/\r?\n/).map((line) => [line])]
    }
  } catch { throw importError('Unable to read this file. Use a valid XLSX workbook or UTF-8 CSV/TXT file.') }
  const emails = new Set()
  let duplicates = 0, ignored = 0, cells = 0
  for (const rows of sheets) for (const row of rows) for (const cell of row) {
    if (++cells > 2000000) throw importError('This file contains too many cells. Export only the email column.')
    if (typeof cell !== 'string' || !cell.trim()) continue
    const value = cell.trim().toLowerCase()
    if (!emailSchema.safeParse(value).success) { if (value.includes('@')) ignored++; continue }
    if (emails.has(value)) duplicates++
    else emails.add(value)
    if (emails.size > 250000) throw importError('Lists are limited to 250,000 unique email addresses.')
  }
  if (!emails.size) throw importError('No valid email cells were found. Put one email address in each cell or TXT line.')
  // The approval workflow stores this normalized payload in its private bucket.
  const values = [...emails]
  if (Buffer.byteLength(JSON.stringify(values)) > 15 * 1024 * 1024) throw importError('The normalized list is too large. Split it into smaller files.', 413)
  return { emails: values, duplicates, ignored }
}
