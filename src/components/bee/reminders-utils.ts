/**
 * Форматирование времени напоминаний для панелей и списков.
 * Общий модуль для дашборда и страницы напоминаний.
 */
import { format, isToday, isTomorrow, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'

/** «сегодня, 14:30» / «завтра, 09:00» / «21 ноября, 18:00». */
export function whenLabelShort(iso: string): string {
  const d = new Date(iso)
  const hm = format(d, 'HH:mm')
  if (isToday(d)) return `сегодня, ${hm}`
  if (isTomorrow(d)) return `завтра, ${hm}`
  return `${format(d, 'd MMMM', { locale: ru })}, ${hm}`
}

/** «Сегодня» / «Завтра» / «21 ноября, пятница». */
export function dayLabel(d: Date): string {
  if (isToday(d)) return 'Сегодня'
  if (isTomorrow(d)) return 'Завтра'
  return format(d, 'd MMMM, EEEE', { locale: ru })
}

/** Начало текущего дня (для группировки). */
export function todayStart(): number {
  return startOfDay(new Date()).getTime()
}
