// Удаляет временного QA-пользователя, созданного для проверки анимаций
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const u = await db.user.findUnique({ where: { name: 'qa-anim' } })
if (u) {
  await db.apiaryPoint.deleteMany({ where: { userId: u.id } })
  await db.reminder.deleteMany({ where: { userId: u.id } })
  await db.user.delete({ where: { name: 'qa-anim' } })
  console.log('qa-anim удалён')
} else {
  console.log('qa-anim не найден')
}
await db.$disconnect()
