/** Проверка перегенерированного датасета истории: диапазоны веса/t/влажности. */
import { HISTORY_BY_HIVE, HISTORY_DAYS, HISTORY_HIVES } from '../src/lib/history-data'

const hives = Object.keys(HISTORY_BY_HIVE).length
console.log('ульев:', hives, '· дней:', HISTORY_DAYS, '· список:', HISTORY_HIVES.join(','))
const h1 = HISTORY_BY_HIVE[1]
console.log('улей 1: первый день', h1[0], '· последний', h1[h1.length - 1])

let minW = 1e9
let maxW = -1e9
let minT = 1e9
let maxT = -1e9
let minH = 1e9
let maxH = -1e9
let alarms = 0
for (const h of Object.values(HISTORY_BY_HIVE)) {
  for (const r of h) {
    for (const w of [r.w08, r.w20]) { minW = Math.min(minW, w); maxW = Math.max(maxW, w) }
    for (const t of [r.t08, r.t20]) { minT = Math.min(minT, t); maxT = Math.max(maxT, t) }
    for (const hh of [r.h08, r.h20]) { minH = Math.min(minH, hh); maxH = Math.max(maxH, hh) }
    // пороги тревог isHistoryAlarm: t>=36 || t<=33.5 || h>=58 || h<=36
    for (const [t, hh] of [[r.t08, r.h08], [r.t20, r.h20]]) {
      if (t >= 36 || t <= 33.5 || hh >= 58 || hh <= 36) alarms++
    }
  }
}
console.log('вес:', minW, '–', maxW, 'кг · t:', minT, '–', maxT, '°C · влажн:', minH, '–', maxH, '%')
console.log('якорей с тревогой по t/влажности:', alarms, '(здоровая история — должно быть 0)')
