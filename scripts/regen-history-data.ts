/**
 * Перегенерация якорных данных истории (src/lib/history-data.ts):
 * приводит старую выгрузку к реальным биологическим параметрам пасеки:
 *  — вес 3-корпусного улья дадан в пике 150–170 кг (сдвиг по улью);
 *  — температура расплодной части постоянна ≈ 35 °C (сжатие разброса);
 *  — влажность расплодной части 40–50 %.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = '/home/z/my-project/src/lib/history-data.ts'
const src = readFileSync(FILE, 'utf8')

// Извлекаем объект RAW (литерал без TS-типов — можно вычислить через Function)
const start = src.indexOf('const RAW: Record<number, number[][]> = {')
const objStart = src.indexOf('{', start)
// Ищем закрывающую скобку объекта: "}\n}" перед "export interface" — берём до строки с '}' на отдельной строке после блоков ульев
const endMarker = src.indexOf('\n}', objStart)
const literal = src.slice(objStart, endMarker + 2)
// eslint-disable-next-line no-new-func
const RAW = new Function(`return ${literal}`)() as Record<number, number[][]>

// Сдвиг веса по улью, чтобы min ≥ ~148 и max попал в диапазон пика 150–170 кг
const WEIGHT_OFFSET: Record<number, number> = {
  1: 87, 2: 96, 3: 87, 4: 88, 5: 95.5, 6: 89, 7: 89, 8: 94.3,
}

const r1 = (x: number) => Math.round(x * 10) / 10

function transformRow(row: number[], hive: number): number[] {
  const [w08, t08, h08, w20, t20, h20] = row
  const off = WEIGHT_OFFSET[hive] ?? 87
  // вес: сдвиг в диапазон 3-корпусного дадана
  const W = (w: number) => r1(w + off)
  // температура расплодной части: сжатие вокруг постоянных 35 °C
  const T = (t: number) => r1(35.0 + (t - 35.0) * 0.35)
  // влажность расплодной части: 40–50 %
  const H = (h: number) => Math.round(45.5 + (h - 60) * 0.3)
  return [W(w08), T(t08), H(h08), W(w20), T(t20), H(h20)]
}

const fmtRow = (r: number[]) => `[${r.join(',')}]`

const lines: string[] = []
let minW = Infinity
let maxW = -Infinity
let minT = Infinity
let maxT = -Infinity
let minH = Infinity
let maxH = -Infinity
for (const hive of Object.keys(RAW).map(Number).sort((a, b) => a - b)) {
  const rows = RAW[hive].map((row) => transformRow(row, hive))
  for (const [w08, t08, h08, w20, t20, h20] of rows) {
    for (const w of [w08, w20]) { minW = Math.min(minW, w); maxW = Math.max(maxW, w) }
    for (const t of [t08, t20]) { minT = Math.min(minT, t); maxT = Math.max(maxT, t) }
    for (const h of [h08, h20]) { minH = Math.min(minH, h); maxH = Math.max(maxH, h) }
  }
  lines.push(`  ${hive}: [${rows.map(fmtRow).join(',')}],`)
}

const newRaw = `const RAW: Record<number, number[][]> = {\n${lines.join('\n')}\n}`
const out = src.slice(0, objStart) + newRaw + src.slice(endMarker + 2)

// Обновляем шапку-комментарий: добавляем строку о приведении к реальным параметрам
const headerAnchor = ' * закрыты предыдущими значениями (0 якорей).'
if (out.includes(headerAnchor)) {
  out.replace(headerAnchor, headerAnchor) // no-op guard
}
const headerAdd = headerAnchor + '\n * Приведено к реальным параметрам пасеки (scripts/regen-history-data.ts):\n * вес 3-корпусного улья дадан 150–170 кг, t расплода ≈ 35 °C, влажность 40–50 %.'
const outFinal = out.replace(headerAnchor, headerAdd)

writeFileSync(FILE, outFinal, 'utf8')
console.log(`Готово. Диапазоны после преобразования:`)
console.log(`  вес: ${minW} … ${maxW} кг`)
console.log(`  температура: ${minT} … ${maxT} °C`)
console.log(`  влажность: ${minH} … ${maxH} %`)
