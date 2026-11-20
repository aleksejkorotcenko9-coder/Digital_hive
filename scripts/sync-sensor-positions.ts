// Синхронизация координат ульев с каталогом датчиков: если физический датчик
// переставили в другое место, его новая GPS-позиция применяется ко всем точкам,
// где он привязан. Идемпотентно — можно запускать многократно.
import { PrismaClient } from '@prisma/client'
import { SENSOR_CATALOG } from '../src/lib/sensor-catalog'

const db = new PrismaClient()

const MOVED = ['SN-2518-0711', 'SN-2518-0712', 'SN-2518-0713']
const byCode = new Map(SENSOR_CATALOG.map((s) => [s.code, s]))

let updated = 0
for (const code of MOVED) {
  const s = byCode.get(code)
  if (!s) continue
  const res = await db.apiaryPoint.updateMany({
    where: { sensorCode: code, OR: [{ lat: { not: s.lat } }, { lon: { not: s.lon } }] },
    data: { lat: s.lat, lon: s.lon },
  })
  updated += res.count
  if (res.count > 0) console.log(`${code}: обновлено точек ${res.count} → ${s.lat}, ${s.lon} (${s.note})`)
}
console.log(`Готово: синхронизировано точек ${updated}`)
await db.$disconnect()
