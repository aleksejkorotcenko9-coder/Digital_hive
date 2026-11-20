// Одноразовый скрипт: убираем старые стартовые точки карты.
// Теперь улей привязывается по коду датчика (по одному на пользователя),
// поэтому предзаполненные демо-точки больше не нужны.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const before = await db.apiaryPoint.count()
await db.apiaryPoint.deleteMany({})
const after = await db.apiaryPoint.count()
console.log(`apiaryPoint: ${before} -> ${after} (стартовые точки удалены)`)

await db.$disconnect()
