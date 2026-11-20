/**
 * Проверка подкрутки ИИ: «Календарь цветения медоносов» и смежные вопросы.
 * Проверяем маршрутизацию сценариев и содержимое календаря (эталонные окна,
 * корректировка от дат посева Минсельхоза, сезонная заметка, два сорта мёда).
 */
import { askAgent, makeContext, type AgentCropField } from '../src/lib/agent'
import type { Hive } from '../src/lib/hive-model'

const hive: Hive = {
  id: 1,
  label: 'Улей №1',
  familyNote: '',
  humiditySensorOk: true,
  humidityOfflineFrom: null,
  series: [],
}

// Поля как в bootstrap (Минсельхоз, Рязанская обл.) — с датами посева.
const cropFields: AgentCropField[] = [
  {
    name: 'Поле «Заисток»',
    culture: 'buckwheat',
    cultureName: 'Гречиха',
    areaHa: 120,
    district: 'Рыбновский',
    distanceKm: 7,
    sowingDate: '2026-05-20',
    bloomText: '27.06–22.07',
    bloomStart: '2026-06-27',
    bloomEnd: '2026-07-22',
    recommend: { min: 180, max: 240, optimal: 210 },
    treatments: [{ date: '2026-06-10', drug: 'Инсектицид', hazardClass: '3' }],
    isMinselhoz: true,
  },
  {
    name: 'Пойменный участок',
    culture: 'melilot',
    cultureName: 'Донник',
    areaHa: 60,
    district: 'Рыбновский',
    distanceKm: 11,
    sowingDate: '2025-05-12',
    bloomText: '16.06–15.08',
    bloomStart: '2026-06-16',
    bloomEnd: '2026-08-15',
    recommend: { min: 60, max: 120, optimal: 90 },
    treatments: [],
    isMinselhoz: true,
  },
]

const ctx = makeContext([hive], {
  weather: [],
  pesticide: null,
  sites: [],
  cropFields,
  apiaryName: 'Моя пасека',
})

const questions = [
  'Календарь цветения медоносов',
  'Когда цветёт липа?',
  'Сроки цветения гречихи',
  'Куда везти пасеку к цветению?',
  'Погода и медосбор на неделю?',
  'Есть ли риск роения?',
  'Как дела на пасеке?',
]

let failed = 0
for (const q of questions) {
  const a = askAgent(q, 1, ctx)
  const okScenario =
    (q === 'Календарь цветения медоносов' && a.scenario === 'bloom') ||
    (q === 'Когда цветёт липа?' && a.scenario === 'bloom') ||
    (q === 'Сроки цветения гречихи' && a.scenario === 'bloom') ||
    (q === 'Куда везти пасеку к цветению?' && a.scenario === 'migration') ||
    (q === 'Погода и медосбор на неделю?' && a.scenario === 'weather') ||
    (q === 'Есть ли риск роения?' && a.scenario === 'swarm') ||
    (q === 'Как дела на пасеке?' && a.scenario === 'status')
  if (!okScenario) failed++
  console.log(`\n=== «${q}» → сценарий: ${a.scenario} ${okScenario ? 'OK' : '!! ОШИБКА МАРШРУТА'}`)
  console.log(a.text)
  console.log('basis:', a.basis.join(' | '))
  console.log('metrics:', a.metrics.map((m) => `${m.label}=${m.value}`).join('; '))
}

// Проверки содержимого календаря
const cal = askAgent('Календарь цветения медоносов', 1, ctx)
const checks: Array<[string, boolean]> = [
  ['Гречиха с эталоном 20.06–15.07', cal.text.includes('Гречиха — 20.06–15.07')],
  ['Липа с эталоном 20.06–10.07', cal.text.includes('Липа — 20.06–10.07')],
  ['Донник с эталоном 20.06–20.08', cal.text.includes('Донник — 20.06–20.08')],
  ['Корректировка от посева: поле гречихи', cal.text.includes('Поле «Заисток» — Гречиха, цветение 27.06–22.07 (на 7 дн. позже эталона)')],
  ['Корректировка от посева: донник', cal.text.includes('Пойменный участок — Донник, цветение 16.06–15.08')],
  ['Зимняя заметка сезона', cal.text.includes('зимний покой')],
  ['Совет про два сорта мёда', cal.text.includes('два сорта мёда')],
  ['Basis: агрокалендарь', cal.basis.some((b) => b.includes('Агрокалендарь'))],
  ['Basis: Минсельхоз', cal.basis.some((b) => b.includes('Минсельхоза'))],
]
const lipa = askAgent('Когда цветёт липа?', 1, ctx)
checks.push(['Липа: ответ начинается с её окна', lipa.text.startsWith('Липа: цветение 20.06–10.07')])
checks.push(['Липа: заметка с заглавной', lipa.text.includes('кг/га. Лесной массив')])
const grecha = askAgent('Сроки цветения гречихи', 1, ctx)
checks.push(['Гречиха в родительном падеже — на первом месте', grecha.text.startsWith('Гречиха: цветение 20.06–15.07')])

console.log('\n--- проверки содержимого ---')
for (const [name, ok] of checks) {
  if (!ok) failed++
  console.log(`${ok ? 'OK ' : 'FAIL'} ${name}`)
}

console.log(failed === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛЕНО: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
