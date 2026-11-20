// Предзасев почасового журнала SensorLog для всех ульев с датчиками
// (источник — якорная CSV-выгрузка telemetry_hives_large.csv). Идемпотентно:
// ульи, у которых записи уже есть, не трогаем. Запуск: bun run scripts/seed-history-logs.ts
import { PrismaClient } from '@prisma/client'
import { HISTORY_BY_HIVE, HISTORY_DAYS, HISTORY_HIVES } from '../src/lib/history-data'
import { generateHourlyLogsLocal } from '../src/lib/history-generate'

const db = new PrismaClient()

async function main() {
  const points = await db.apiaryPoint.findMany({ orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }] })
  let created = 0
  const counters = new Map<string, number>()
  for (const p of points) {
    if (!p.hasSensor || !p.sensorCode) continue
    const idx = counters.get(p.userId) ?? 0
    counters.set(p.userId, idx + 1)
    const existing = await db.sensorLog.count({ where: { pointId: p.id } })
    if (existing > 0) {
      console.log(`${p.name} (${p.sensorCode}): уже есть ${existing} записей`)
      continue
    }
    const csvHive = HISTORY_HIVES[idx % HISTORY_HIVES.length]
    const rows = generateHourlyLogsLocal(p.id, p.userId, csvHive, HISTORY_BY_HIVE, HISTORY_DAYS)
    for (let k = 0; k < rows.length; k += 600) {
      await db.sensorLog.createMany({ data: rows.slice(k, k + 600) })
    }
    created += rows.length
    console.log(`${p.name} (${p.sensorCode}): создано ${rows.length} почасовых записей (семья №${csvHive} из CSV)`)
  }
  const total = await db.sensorLog.count()
  console.log(`Итого записей в журнале: ${total} (создано сейчас: ${created})`)
  await db.$disconnect()
}
main()
