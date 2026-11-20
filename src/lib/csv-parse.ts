/**
 * Парсер CSV-файлов телеметрии (серверная утилита, без внешних зависимостей).
 * Понимает:
 *  - разделители «;» и «,», кавычки, любые переносы строк;
 *  - кодировку UTF-8 и windows-1251 (частый случай экспорта из Excel);
 *  - русские и английские заголовки колонок в любом порядке;
 *  - даты dd.MM.yyyy, dd.MM.yy, yyyy-MM-dd (+ время HH:mm(:ss));
 *  - числа с запятой в качестве десятичного разделителя («72,2»).
 *
 * Формат отклика: { rows, errors } — строки с ошибками не прерывают загрузку.
 */

export interface CsvRow {
  ts: Date
  hiveNumber: number | null
  weightKg: number | null
  tempC: number | null
  humidityPct: number | null
}

export interface CsvParseResult {
  rows: CsvRow[]
  errors: string[]
  delimiter: string
  hadHeader: boolean
}

const MAX_ROWS = 10000

/* ------------------------------------------------------------------ */
/* Декодирование                                                       */
/* ------------------------------------------------------------------ */

export function decodeCsvBuffer(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  if (!utf8.includes('\uFFFD')) return utf8.replace(/^\uFEFF/, '')
  // есть «битые» символы — пробуем windows-1251 (Excel по умолчанию в ru-локали)
  try {
    return new TextDecoder('windows-1251').decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return utf8
  }
}

/* ------------------------------------------------------------------ */
/* Разбор ячеек                                                        */
/* ------------------------------------------------------------------ */

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur.trim())
  return cells
}

function sniffDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n')
  const semi = (sample.match(/;/g) ?? []).length
  const comma = (sample.match(/,/g) ?? []).length
  return semi >= comma ? ';' : ','
}

/* ------------------------------------------------------------------ */
/* Заголовки                                                           */
/* ------------------------------------------------------------------ */

type ColKind = 'date' | 'hive' | 'weight' | 'temp' | 'humidity' | 'unknown'

const HEADER_PATTERNS: Array<{ kind: ColKind; re: RegExp }> = [
  { kind: 'weight', re: /(вес|масса|weight)/i },
  { kind: 'temp', re: /(темп|temp)/i },
  { kind: 'humidity', re: /(влажн|humidity)/i },
  { kind: 'hive', re: /(улей|улье|hive|номер|№|\bid\b)/i },
  { kind: 'date', re: /(дата|date|время|time|timestamp)/i },
]

function headerKind(cell: string): ColKind {
  for (const p of HEADER_PATTERNS) {
    if (p.re.test(cell)) return p.kind
  }
  return 'unknown'
}

/* ------------------------------------------------------------------ */
/* Даты и числа                                                        */
/* ------------------------------------------------------------------ */

const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const RU_RE = /^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/

export function parseCsvDate(raw: string): Date | null {
  const s = raw.trim().replace('T', ' ')
  let m = ISO_RE.exec(s)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 12), Number(m[5] ?? 0), Number(m[6] ?? 0))
    return Number.isNaN(d.getTime()) ? null : d
  }
  m = RU_RE.exec(s)
  if (m) {
    let year = Number(m[3])
    if (year < 100) year += 2000
    const d = new Date(year, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 12), Number(m[5] ?? 0), Number(m[6] ?? 0))
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function parseCsvNumber(raw: string): number | null {
  if (raw == null) return null
  const cleaned = raw
    .replace(/[\s\u00A0]/g, '')
    .replace(',', '.')
    .replace(/[^0-9.+\-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '+' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseHiveNumber(raw: string): number | null {
  const m = /(\d+)/.exec(raw)
  if (!m) return null
  return Number(m[1])
}

/* ------------------------------------------------------------------ */
/* Главная функция                                                     */
/* ------------------------------------------------------------------ */

export function parseCsv(text: string): CsvParseResult {
  const errors: string[] = []
  const rows: CsvRow[] = []

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) {
    return { rows, errors: ['Файл пуст'], delimiter: ';', hadHeader: false }
  }

  const delimiter = sniffDelimiter(lines)
  const firstCells = splitLine(lines[0], delimiter)
  const hadHeader = firstCells.some((c) => headerKind(c) !== 'unknown')

  // карта колонок: если есть заголовок — по нему, иначе фиксированный порядок
  type MappedCols = Record<Exclude<ColKind, 'unknown'>, number>
  let colMap: MappedCols = { date: 0, hive: 1, weight: 2, temp: 3, humidity: 4 }
  if (hadHeader) {
    colMap = { date: -1, hive: -1, weight: -1, temp: -1, humidity: -1 }
    firstCells.forEach((cell, idx) => {
      const kind = headerKind(cell)
      if (kind !== 'unknown' && colMap[kind] === -1) colMap[kind] = idx
    })
    if (colMap.date === -1) {
      return { rows, errors: ['Не найдена колонка с датой. Скачайте шаблон и добавьте колонку «дата»'], delimiter, hadHeader }
    }
  }

  const dataLines = hadHeader ? lines.slice(1) : lines
  for (let i = 0; i < dataLines.length; i++) {
    if (rows.length >= MAX_ROWS) {
      errors.push(`Строк больше ${MAX_ROWS} — загружены только первые`)
      break
    }
    const lineNo = (hadHeader ? 1 : 0) + i + 1
    const cells = splitLine(dataLines[i], delimiter)
    const ts = colMap.date >= 0 ? parseCsvDate(cells[colMap.date] ?? '') : null
    if (!ts) {
      errors.push(`Строка ${lineNo}: не удалось прочитать дату «${cells[colMap.date] ?? ''}»`)
      continue
    }
    const hiveNumber =
      colMap.hive >= 0 ? parseHiveNumber(cells[colMap.hive] ?? '') : null
    const weightKg = colMap.weight >= 0 ? parseCsvNumber(cells[colMap.weight] ?? '') : null
    const tempC = colMap.temp >= 0 ? parseCsvNumber(cells[colMap.temp] ?? '') : null
    const humidityPct = colMap.humidity >= 0 ? parseCsvNumber(cells[colMap.humidity] ?? '') : null
    if (weightKg === null && tempC === null && humidityPct === null) {
      errors.push(`Строка ${lineNo}: нет ни одного значения (вес/температура/влажность)`)
      continue
    }
    rows.push({ ts, hiveNumber, weightKg, tempC, humidityPct })
  }

  return { rows, errors, delimiter, hadHeader }
}
