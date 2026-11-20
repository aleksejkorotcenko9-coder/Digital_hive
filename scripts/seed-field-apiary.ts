// Засев «пасеки в поле»: три улья с датчиками стоят рядом в открытом поле
// подальше от города (как настоящая пасека). Точки создаются каждому
// пользователю; предыдущие точки карты убираем, чтобы список был чистым.
import { PrismaClient } from '@prisma/client'
import { SENSOR_CATALOG } from '../src/lib/sensor-catalog'

const db = new PrismaClient()

// Координаты пасеки в поле у Белебея (~90 км от Уфы) — берём из каталога датчиков
const FIELD = SENSOR_CATALOG.filter((s) => s.zone === 'field')

const users = await db.user.findMany({ select: { id: true } })
const before = await db.apiaryPoint.count()
await db.apiaryPoint.deleteMany({})
for (const u of users) {
  await db.apiaryPoint.createMany({
    data: FIELD.map((s, i) => ({
      userId: u.id,
      name: `Поле у Белебея — улей ${i + 1}`,
      lat: s.lat,
      lon: s.lon,
      hiveCount: 1,
      hasSensor: true,
      sensorOn: true,
      sensorCode: s.code,
    })),
  })
}
const after = await db.apiaryPoint.count()
console.log(`Пасека в поле: было точек ${before}, стало ${after} (по ${FIELD.length} на каждого из ${users.length} пользователей)`)
await db.$disconnect()
