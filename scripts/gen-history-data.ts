// Разовый генератор: читает upload/telemetry_hives_large.csv и создаёт
// src/lib/history-data.ts — компактный якорный массив для почасового журнала.
// В CSV: дата;улей;вес, кг;температура, °C;влажность, % (десятичные через запятую,
// фиксации в 8:00 и 20:00). Скрипт запускается вручную: bun run scripts/gen-history-data.ts
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'upload/telemetry_hives_large.csv'
const OUT = 'src/lib/history-data.ts'

const raw = readFileSync(SRC, 'utf8')
const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
// шапка: дата;улей;вес, кг;температура, °C;влажность, % (с BOM)
const num = (s: string): number => Number(s.replace(',', '.').trim())

/** hive → dayIndex (0 = 01.07.2026) → [w08, t08, h08, w20, t20, h20] */
const byHive = new Map<number, Array<[number, number, number, number, number, number]>>()
let parsed = 0
let skipped = 0
let minDay = Number.POSITIVE_INFINITY

for (const line of lines.slice(1)) {
  const parts = line.split(';').map((p) => p.trim())
  if (parts.length < 5) {
    skipped++
    continue
  }
  const m = parts[0].match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/)
  if (!m) {
    skipped++
    continue
  }
  const hive = Number(parts[1])
  const w = num(parts[2])
  const t = num(parts[3])
  const h = num(parts[4])
  const hour = Number(m[4])
  if (!Number.isFinite(hive) || !Number.isFinite(w) || !Number.isFinite(t) || !Number.isFinite(h)) {
    skipped++
    continue
  }
  const day = Math.round((Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) - Date.UTC(2026, 6, 1)) / 86400000)
  if (day < 0) {
    skipped++
    continue
  }
  minDay = Math.min(minDay, day)
  let arr = byHive.get(hive)
  if (!arr) {
    arr = []
    byHive.set(hive, arr)
  }
  while (arr.length <= day) arr.push(null as unknown as [number, number, number, number, number, number])
  const row = arr[day] ?? [NaN, NaN, NaN, NaN, NaN, NaN]
  if (hour === 8) {
    row[0] = w
    row[1] = t
    row[2] = h
  } else if (hour === 20) {
    row[3] = w
    row[4] = t
    row[5] = h
  }
  arr[day] = row
  parsed++
}

// пропуски в якорях — держим предыдущие значения, чтобы интерполяция не ломалась
const hives = [...byHive.keys()].sort((a, b) => a - b)
let filled = 0
for (const hive of hives) {
  const arr = byHive.get(hive)!
  let last: [number, number, number, number, number, number] | null = null
  for (let i = 0; i < arr.length; i++) {
    const r = arr[i]
    if (!r || Number.isNaN(r[0]) || Number.isNaN(r[3])) {
      const base = last ?? [61, 34.5, 55, 61.2, 34.6, 56]
      const cur = r && !Number.isNaN(r[0]) ? r : [NaN, NaN, NaN, NaN, NaN, NaN]
      arr[i] = [
        Number.isNaN(cur[0]) ? base[0] : cur[0],
        Number.isNaN(cur[1]) ? base[1] : cur[1],
        Number.isNaN(cur[2]) ? base[2] : cur[2],
        Number.isNaN(cur[3]) ? base[3] : cur[3],
        Number.isNaN(cur[4]) ? base[4] : cur[4],
        Number.isNaN(cur[5]) ? base[5] : cur[5],
      ]
      filled++
    }
    last = arr[i]
  }
}

const HISTORY_DAYS_OUT = Math.max(...hives.map((h) => byHive.get(h)!.length))
const body = hives
  .map((hive) => {
    const arr = byHive.get(hive)!
    const rows = arr.map((r) => `[${r.map((v) => Math.round(v * 10) / 10).join(',')}]`).join(',')
    return `  ${hive}: [${rows}],`
  })
  .join('\n')

const ts = `/**
 * Якорные точки истории датчиков — сгенерировано из upload/telemetry_hives_large.csv
 * (scripts/gen-history-data.ts). ${hives.length} ульев, ${hives.reduce((s, h) => s + byHive.get(h)!.length, 0)} суточных якорей:
 * [вес 8:00, t 8:00, влажн. 8:00, вес 20:00, t 20:00, влажн. 20:00].
 * Первый день — ${'2026-07-01'}, всего ${HISTORY_DAYS_OUT} дней. Пропущенные строки CSV (${skipped})
 * закрыты предыдущими значениями (${filled} якорей).
 * Индексы — день от начала: 0 → 1 июля 2026 (UTC). Все времена — UTC «стеночные часы» CSV.
 */
export interface HistoryAnchorRow {
  w08: number
  t08: number
  h08: number
  w20: number
  t20: number
  h20: number
}

export const HISTORY_DAYS = ${HISTORY_DAYS_OUT}
export const HISTORY_HIVES = [${hives.join(', ')}]

const RAW: Record<number, number[][]> = {
${body}
}

export const HISTORY_BY_HIVE: Record<number, HistoryAnchorRow[]> = Object.fromEntries(
  Object.entries(RAW).map(([hive, days]) => [
    Number(hive),
    days.map((r) => ({ w08: r[0], t08: r[1], h08: r[2], w20: r[3], t20: r[4], h20: r[5] })),
  ]),
)
`
writeFileSync(OUT, ts, 'utf8')
console.log(`готово: ${parsed} строк CSV → ${hives.length} ульев; пропущено ${skipped}, заполнено ${filled}; выход ${OUT}`)
