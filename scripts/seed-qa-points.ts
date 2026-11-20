// Точки пасеки для QA-пользователя (qa-anim): три улья с датчиками
// в поле у Белебея — как в сценарии демо. Точки других пользователей
// не трогаем (в отличие от seed-field-apiary.ts, который пересеивает всем).
import { PrismaClient } from '@prisma/client'
import { SENSOR_CATALOG } from '../src/lib/sensor-catalog'

const db = new PrismaClient()

const user = await db.user.findUnique({ where: { name: 'qa-anim' }, select: { id: true } })
if (!user) {
  console.error('Пользователь qa-anim не найден — сначала запустите make-tmp-user.ts')
  process.exit(1)
}

await db.apiaryPoint.deleteMany({ where: { userId: user.id } })
const FIELD = SENSOR_CATALOG.filter((s) => s.zone === 'field')
await db.apiaryPoint.createMany({
  data: FIELD.map((s, i) => ({
    userId: user.id,
    name: `Поле у Белебея — улей ${i + 1}`,
    lat: s.lat,
    lon: s.lon,
    hiveCount: 1,
    hasSensor: true,
    sensorOn: true,
    sensorCode: s.code,
  })),
})
const n = await db.apiaryPoint.count({ where: { userId: user.id } })
console.log(`qa-anim: точек ${n} (поле у Белебея, датчики активны)`)
await db.$disconnect()
