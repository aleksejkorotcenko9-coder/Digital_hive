/**
 * Разовая миграция данных к реальным биологическим параметрам:
 *  — SensorLog (журнал датчиков) пересеется сам из обновлённого history-data.ts;
 *  — Measurement (журнал измерений) — обновляем значения под нормы:
 *    вес 3-корпусного дадана ~150–168 кг, t ≈ 35 °C, влажность 40–50 %.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Прямые замены: старое значение → новое (вес, t, влажность)
const UPDATES: Array<{ id: string; weightKg: number; tempC: number; humidityPct: number | null }> = [
  { id: '', weightKg: 0, tempC: 0, humidityPct: null }, // placeholder, заполняется ниже по id
]

async function main() {
  // 1. Журнал датчиков: очищаем — пересеется лениво из новых якорей
  const logs = await db.sensorLog.deleteMany({})
  console.log('SensorLog удалено:', logs.count)

  // 2. Измерения: приводим к нормам по id (из вывода inspect)
  const plan: Array<{ ends: string; weightKg: number; tempC: number; humidityPct: number | null }> = [
    { ends: 'w5t9ez', weightKg: 152.4, tempC: 34.9, humidityPct: 45 },
    { ends: 'iu26vl', weightKg: 158.2, tempC: 35.0, humidityPct: 47 },
    { ends: 'ntia99', weightKg: 149.1, tempC: 34.8, humidityPct: null },
    { ends: 'k6uh8y', weightKg: 157.6, tempC: 35.0, humidityPct: 45 },
    { ends: '37kmxm', weightKg: 159.5, tempC: 35.0, humidityPct: 46 },
    { ends: 'y8ov4t', weightKg: 160.1, tempC: 34.9, humidityPct: 45 },
    { ends: 'm9gb1l', weightKg: 155.0, tempC: 34.8, humidityPct: null },
  ]
  const all = await db.measurement.findMany()
  let n = 0
  for (const m of all) {
    const p = plan.find((x) => m.id.endsWith(x.ends))
    if (!p) continue
    await db.measurement.update({
      where: { id: m.id },
      data: { weightKg: p.weightKg, tempC: p.tempC, humidityPct: p.humidityPct },
    })
    n++
  }
  console.log('Measurement обновлено:', n)
  await db.$disconnect()
}

void main()
