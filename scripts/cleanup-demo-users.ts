/**
 * Разовая уборка «бета-эры»: удалить аккаунты без email (демо-пара
 * pasichnik/pomoshchnik и тестовые nina/ivan). Реальные аккаунты
 * с подтверждённым email не трогаются. Каскад удалит их сессии,
 * напоминания и точки пасек.
 */
import { db } from '../src/lib/db'

const gone = await db.user.deleteMany({
  where: { email: null },
})
console.log('удалено аккаунтов без email:', gone.count)

const rest = await db.user.findMany({
  select: { name: true, email: true, emailVerified: true, role: true },
})
console.log('остались:', JSON.stringify(rest, null, 1))
await db.$disconnect()
