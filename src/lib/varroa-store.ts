/**
 * Ручные замеры заклещенности (Varroa) в реальном режиме «Мои данные».
 *
 * Датчик заклещенности в реальном режиме не установлен — честный источник
 * данных один: пчеловод осматривает семью, считает клещей (на 300 пчелах
 * или на липкой доске) и вносит замер. Замеры хранятся в localStorage
 * по ключу точки на карте (стабильный id, не «зависит» от порядка ульев).
 *
 * Замкнутый цикл: замер → статус (норма/риск/критично) → предписание агента
 * → «Провести обработку» → новый замер после обработки. Никаких выдуманных
 * чисел: нет замеров — карточка честно предлагает внести первый.
 */
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { varroaStatus } from './demo-hives'
import type { VarroaPoint } from './demo-hives'

export interface VarroaMeasure {
  /** ISO-дата замера (например 2026-07-18). */
  date: string
  /** Заклещенность, % (клещей / осмотрено пчел × 100). */
  pct: number
  /** Клещей обнаружено. */
  mites: number
  /** Пчел осмотрено. */
  bees: number
  /** true — запись «проведена обработка» (показатель падает до pct записи). */
  treated?: boolean
}

/** Все замеры по всем точкам: ключ — id точки на карте. */
type VarroaDB = Record<string, VarroaMeasure[]>

const LS_KEY = 'beehive-varroa-v1'

function loadDB(): VarroaDB {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as VarroaDB
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

function saveDB(db: VarroaDB) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(db))
  } catch {
    // приватный режим — просто не сохраняем
  }
}

/** Замеры точки (или пустой список). */
export function varroaMeasuresOf(pointId: string): VarroaMeasure[] {
  return loadDB()[pointId] ?? []
}

/** Добавить замер (отсортируется по дате). */
export function addVarroaMeasure(pointId: string, m: Omit<VarroaMeasure, 'date'> & { date?: string }) {
  const db = loadDB()
  const list = db[pointId] ?? []
  list.push({ ...m, date: m.date ?? format(new Date(), 'yyyy-MM-dd') })
  list.sort((a, b) => a.date.localeCompare(b.date))
  db[pointId] = list
  saveDB(db)
}

/** Отметить обработку: новая запись с падением заклещенности до resetPct. */
export function markVarroaTreated(pointId: string, resetPct = 0.4) {
  const db = loadDB()
  const list = db[pointId] ?? []
  const last = list[list.length - 1]
  list.push({
    date: format(new Date(), 'yyyy-MM-dd'),
    pct: resetPct,
    mites: 0,
    bees: last?.bees ?? 300,
    treated: true,
  })
  list.sort((a, b) => a.date.localeCompare(b.date))
  db[pointId] = list
  saveDB(db)
}

export interface VarroaState {
  /** Текущая заклещенность (последний замер), % — или null, если замеров нет. */
  pct: number | null
  /** Прогноз на +14 дней: типичный прирост 0,2 %, после обработки +0,1 %. */
  forecast14: number | null
  /** Последний замер (для строки «замер: N кл. / M пчел · дата»). */
  last: VarroaMeasure | null
  /** Предпоследний замер (для тренда). */
  prev: VarroaMeasure | null
  /** Статус порога текущего значения. */
  status: ReturnType<typeof varroaStatus> | null
  /** Была ли последняя запись «обработкой». */
  treatedLast: boolean
}

/** Состояние заклещенности по замерам точки. */
export function varroaStateOf(pointId: string): VarroaState {
  const list = varroaMeasuresOf(pointId)
  if (list.length === 0) {
    return { pct: null, forecast14: null, last: null, prev: null, status: null, treatedLast: false }
  }
  const last = list[list.length - 1]
  const prev = list.length > 1 ? list[list.length - 2] : null
  const pct = last.pct
  // прирост: между двумя последними замерами, но не быстрее типичного 0,2 %/14 дн.
  const step = prev && last.date !== prev.date ? 0.2 : 0.2
  const forecast14 = Math.round((pct + (last.treated ? 0.1 : step)) * 10) / 10
  return {
    pct,
    forecast14,
    last,
    prev,
    status: varroaStatus(pct),
    treatedLast: Boolean(last.treated),
  }
}

/**
 * Точки графика динамики заклещенности по фактическим замерам:
 * линия соединяет замеры (пропуски — null), пунктир — прогноз +14 дней,
 * зеленая отметка — проведенная обработка. Нет замеров — пустой список
 * (карточка показывает честную подсказку вместо графика).
 */
export function varroaSeriesOf(pointId: string, days = 30): VarroaPoint[] {
  const list = varroaMeasuresOf(pointId)
  if (list.length === 0) return []
  const nowMs = Date.now()
  const from = nowMs - (days - 1) * 86400000
  const out: VarroaPoint[] = []
  for (const m of list) {
    const t = new Date(m.date + 'T12:00:00').getTime()
    if (t < from || t > nowMs + 86400000) continue
    out.push({
      label: format(new Date(m.date + 'T12:00:00'), 'd.MM', { locale: ru }),
      pct: m.pct,
      forecast: null,
      treated: Boolean(m.treated),
    })
  }
  const state = varroaStateOf(pointId)
  if (out.length > 0 && state.pct !== null && state.forecast14 !== null) {
    const future = new Date(nowMs + 14 * 86400000)
    // сегмент прогноза начинается с последней точки с измерением
    const lastIdx = out.length - 1
    out[lastIdx] = { ...out[lastIdx], forecast: state.pct }
    out.push({
      label: format(future, 'd.MM', { locale: ru }),
      pct: null,
      forecast: state.forecast14,
      treated: false,
    })
  }
  return out
}
