/**
 * Minimal semicolon-delimited CSV parser for Trade Republic exports.
 * TR uses `;` as delimiter and UTF-8 encoding.
 * Pure function — no fetch, no DB. Handles quoted fields containing `;`.
 */

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

export function parseCsv(text: string, delimiter = ';'): ParsedCsv {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = splitLine(lines[0]!, delimiter).map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]!, delimiter)
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }

  return { headers, rows }
}
