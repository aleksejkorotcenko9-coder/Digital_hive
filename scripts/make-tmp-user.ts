// Создаёт временного проверенного пользователя для проверки переноса датчиков
// (в конце удаляется скриптом cleanup-tmp-user.ts).
import { PrismaClient } from '@prisma/client'
import { scryptSync, randomBytes } from 'node:crypto'
const db = new PrismaClient()
const KEY_LEN = 64
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, KEY_LEN).toString('hex')}`
}
await db.user.upsert({
  where: { name: 'qa-anim' },
  update: { emailVerified: new Date(), passwordHash: hashPassword('uley2026'), role: 'BEEKEEPER' },
  create: {
    name: 'qa-anim',
    email: 'qa-anim@example.com',
    emailVerified: new Date(),
    passwordHash: hashPassword('uley2026'),
    role: 'BEEKEEPER',
  },
})
console.log('qa-anim готов')
await db.$disconnect()
