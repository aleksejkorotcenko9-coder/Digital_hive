// Проверка пользователя из скриншота и последних токенов верификации
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { contains: 'tifox' } },
    select: { id: true, email: true, name: true, emailVerified: true, createdAt: true },
  })
  console.log('=== Пользователи tifox ===')
  console.log(JSON.stringify(users, null, 2))

  const recent = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, email: true, name: true, emailVerified: true, createdAt: true },
  })
  console.log('=== Последние 5 регистраций ===')
  console.log(JSON.stringify(recent, null, 2))

  const tokens = await prisma.verificationToken.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { userId: true, expiresAt: true, createdAt: true },
  })
  console.log('=== Последние 5 токенов ===')
  console.log(JSON.stringify(tokens, null, 2))
}

main().finally(() => prisma.$disconnect())
