/**
 * Фенологические фазы сезона (средняя полоса, Рязанская обл. — ориентир
 * Рыбновского НИИ пчеловодства). Приложение понимает текущий сезон и
 * не показывает летние данные зимой (и наоборот).
 *
 * Фазы:
 *  • winter_rest  (15.11–20.03) — зимний покой: пчёлы в клубе, расплода нет,
 *    привеса нет, расход корма 0,1–0,25 кг/сут, активность минимальна.
 *  • flight_start (20.03–25.04) — первые очистительные облёты, матка начинает
 *    сеять, вес падает за счёт израсходованных запасов.
 *  • buildup      (25.04–05.06) — наращивание семей, поддержка расплода,
 *    слабый принос нектара с поздних медоносов.
 *  • main_flow    (05.06–10.08) — главный медосбор: привесы, расплод сокращён
 *    в пользу мёда, активный лёт.
 *  • autumn_prep  (10.08–15.11) — наращивание зимних пчёл, лечение клеща,
 *    запас кормов на зиму, привеса нет.
 */
export type SeasonPhase = 'winter_rest' | 'flight_start' | 'buildup' | 'main_flow' | 'autumn_prep'

export interface SeasonInfo {
  phase: SeasonPhase
  /** Ключи локализации: season.title.{phase}, season.hint.{phase}. */
  titleKey: string
  hintKey: string
}

function monthDay(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Текущая фаза сезона (по умолчанию — сегодня). */
export function seasonPhase(date: Date = new Date()): SeasonPhase {
  const md = monthDay(date)
  if (md >= '11-15' || md < '03-20') return 'winter_rest'
  if (md < '04-25') return 'flight_start'
  if (md < '06-05') return 'buildup'
  if (md < '08-10') return 'main_flow'
  return 'autumn_prep'
}

export function seasonInfo(date: Date = new Date()): SeasonInfo {
  const phase = seasonPhase(date)
  return { phase, titleKey: `season.title.${phase}`, hintKey: `season.hint.${phase}` }
}

/** Зимний покой? (клуб, без привесов и расплода). */
export function isWinterRest(date: Date = new Date()): boolean {
  return seasonPhase(date) === 'winter_rest'
}

/** Вегетация активна (GDD растёт только в этот период). */
export function vegetationActive(date: Date = new Date()): boolean {
  const phase = seasonPhase(date)
  return phase === 'flight_start' || phase === 'buildup' || phase === 'main_flow'
}

/** Можно ли кочевать (физически переводить пасеку) — не в глухую зиму. */
export function migrationPossible(date: Date = new Date()): boolean {
  const phase = seasonPhase(date)
  return phase !== 'winter_rest' && phase !== 'flight_start'
}

/** Текущий год цветения (посев прошлого года → цветение в этом году). */
export function bloomYearFor(date: Date = new Date()): number {
  return date.getFullYear()
}
