/**
 * Синхронизация диаграмм с ульями на карте.
 *
 * Единый источник данных об ульях — точки на карте пасекы (ApiaryPoint),
 * привязанные по кодам датчиков. Всё, что видит пчеловод, строится из одного
 * набора точек: карта, вкладка «Датчики», диаграммы дашборда и контекст
 * ИИ-агента. Суточные ряды для диаграмм вычисляются той же формулой, что и
 * живые показания датчика (lib/sensor-sim.ts), поэтому «сегодня» на каждом
 * графике совпадает с числом в балунах меток и на вкладке «Датчики».
 *
 * Сезонность: зимой пчёлы в клубе — привеса нет, расход корма 0,1–0,25 кг/сут,
 * температура в ядре клуба 24–28 °C. Ряды и показания датчика следуют
 * фенологической фазе (lib/season.ts).
 */
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DayPoint, Hive } from './hive-model'
import { hashPhase } from './sensor-sim'
import { seasonPhase } from './season'

/** Минимальный набор полей точки, которого достаточно для синхронизации. */
export interface SyncPointRow {
  id: string
  name: string
  hasSensor: boolean
  sensorOn: boolean
  /** Номер улья на корпусе — «Улей №ХХХ» (жёсткая привязка датчика). */
  hiveNumber?: number | null
  /** Код на корпусе датчика — попадает в пояснения к улью. */
  sensorCode?: string | null
  /** contact — контактный в гнезде | ir — инфракрасный. */
  sensorKind?: string | null
  /** center — центр гнезда | periphery — периферия клуба/расплода. */
  sensorPlacement?: string | null
}

/** Дней телеметрии на диаграммах — 30 суток, как у суточных рядов. */
const SERIES_DAYS = 30

/** «1 улей / 2 улья / 5 ульев». */
export function hiveWord(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'улей'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'улья'
  return 'ульев'
}

/**
 * Суточный ряд показаний датчика за последние 30 дней.
 *
 * Температура и влажность считаются той же формулой, что в sensorReading,
 * поэтому последняя точка графика — ровно то значение, которое датчик
 * показывает прямо сейчас. Масса якорится к живому весу; привес зависит
 * от сезона: главный медосбор +0,3–0,75 кг/сут, зима — расход 0,12–0,22 кг/сут.
 * Нет датчика или он выключен — ряд пустой: диаграммы честно без данных.
 */
export function sensorDailySeries(row: SyncPointRow, nowMs: number = Date.now()): DayPoint[] {
  if (!row.hasSensor || !row.sensorOn) return []
  const p = hashPhase(row.id)
  const nowSec = Math.floor(nowMs / 1000)
  const phase = seasonPhase(new Date(nowMs))
  const winter = phase === 'winter_rest'
  const spring = phase === 'flight_start' || phase === 'buildup'
  const autumn = phase === 'autumn_prep'
  // живой вес «сейчас» — та же формула, что в sensorReading (3-корпусный дадан ~150–170 кг)
  const liveWeight = 158.0 + 1.8 * Math.sin(nowSec / 3600 + p) + 0.06 * Math.sin(nowSec / 7 + p * 3)
  // суточный привес по сезону: медосбор 0,30–0,75; весна 0,05–0,15;
  // осень ≈0; зима — расход корма 0,12–0,22 кг/сут
  const gain = winter
    ? -0.12 - 0.1 * (p / (Math.PI * 2))
    : autumn
      ? 0.0 + 0.03 * (p / (Math.PI * 2))
      : spring
        ? 0.05 + 0.1 * (p / (Math.PI * 2))
        : 0.3 + 0.45 * (p / (Math.PI * 2))
  // температура расплодной части: сезонная норма 35 °C;
  // зимой — ядро клуба 24–28 °C (клуб собирается вокруг кормов)
  const tempBase = winter ? 25.5 : spring ? 34.2 : autumn ? 34.0 : 35.0
  const humBase = winter ? 60 : 45
  const out: DayPoint[] = []
  for (let k = SERIES_DAYS - 1; k >= 0; k--) {
    const t = nowMs - k * 86400000
    const tSec = Math.floor(t / 1000)
    const d = new Date(t)
    // расплодная часть: ≈35 °C в сезон, ядро клуба 24–28 °C зимой; влажность 40–50 % (зимой 55–70)
    const tempC = tempBase + 0.15 * Math.sin(tSec / 150 + p) + 0.1 * Math.sin(tSec / 13 + p * 2)
    const humidityPct = humBase + 3 * Math.sin(tSec / 210 + p * 1.3) + 1 * Math.sin(tSec / 29 + p)
    const weightKg = liveWeight - gain * k + 0.15 * Math.sin(k * 1.7 + p)
    out.push({
      date: format(d, 'yyyy-MM-dd'),
      label: format(d, 'd.MM'),
      full: format(d, 'd MMMM', { locale: ru }),
      weightKg: Math.round(weightKg * 10) / 10,
      tempInC: Math.round(tempC * 10) / 10,
      humidityPct: Math.round(humidityPct),
    })
  }
  return out
}

/** «Улей №12» — номер с корпуса датчика (или название точки, если номера нет). */
export function pointHiveLabel(row: SyncPointRow): string {
  return row.hiveNumber ? `Улей №${row.hiveNumber}` : row.name
}

/** Точка на карте → улей для диаграмм, статусов и контекста агента. */
export function pointToHive(row: SyncPointRow, index: number, nowMs: number = Date.now()): Hive {
  const active = row.hasSensor && row.sensorOn
  const phase = seasonPhase(new Date(nowMs))
  const kindWord = row.sensorKind === 'ir' ? 'инфракрасный' : 'контактный'
  const placeWord = row.sensorPlacement === 'periphery' ? 'периферия клуба' : 'центр гнезда'
  const seasonWord =
    phase === 'winter_rest'
      ? 'зимний клуб: ядро 24–28 °C'
      : phase === 'main_flow'
        ? 'расплодная часть ≈35 °C'
        : phase === 'autumn_prep'
          ? 'осенняя подготовка'
          : 'весеннее наращивание'
  return {
    id: row.hiveNumber ?? index + 1,
    label: pointHiveLabel(row),
    familyNote: active
      ? `Датчик ${row.sensorCode ?? '—'} (${kindWord}, ${placeWord}) активен · ${seasonWord}`
      : row.hasSensor
        ? 'Датчик установлен, но выключен — телеметрия приостановлена'
        : 'Датчик не установлен — телеметрии нет',
    humiditySensorOk: active,
    humidityOfflineFrom: null,
    series: sensorDailySeries(row, nowMs),
  }
}

/** Все точки карты → список ульев (единый источник для дашборда и агента). */
export function pointsToHives(rows: SyncPointRow[], nowMs: number = Date.now()): Hive[] {
  return rows.map((row, i) => pointToHive(row, i, nowMs))
}

/**
 * Центр пасеки по её точкам (среднее координат) — для погоды и стартового
 * центра карты. Пустой список → null, вызывающий код подставит запасной центр.
 */
export function pointsCenter(rows: Array<{ lat: number; lon: number }>): [number, number] | null {
  if (rows.length === 0) return null
  const lat = rows.reduce((s, r) => s + r.lat, 0) / rows.length
  const lon = rows.reduce((s, r) => s + r.lon, 0) / rows.length
  return [Math.round(lat * 10000) / 10000, Math.round(lon * 10000) / 10000]
}
