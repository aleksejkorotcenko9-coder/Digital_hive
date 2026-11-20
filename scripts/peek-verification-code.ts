/**
 * Тестовый помощник: восстановить 6-значный код подтверждения из SHA-256 хеша
 * в БД (в приложении такого пути нет — код существует только в письме).
 * Использование:
 *   bun scripts/peek-verification-code.ts <email>            → напечатать код
 *   bun scripts/peek-verification-code.ts <email> --delete   → удалить аккаунт (каскад)
 */
import { createHash } from 'node:crypto'
import { db } from '../src/lib/db'

const email = process.argv[2]?.trim().toLowerCase()
const del = process.argv.includes('--delete')

if (!email) {
  console.error('usage: bun scripts/peek-verification-code.ts <email> [--delete]')
  process.exit(1)
}

const user = await db.user.findUnique({
  where: { email },
  include: { verificationTokens: { orderBy: { createdAt: 'desc' } } },
})
if (!user) {
  console.log('NO-USER')
  process.exit(0)
}

if (del) {
  await db.user.delete({ where: { id: user.id } })
  console.log('DELETED')
} else {
  const rec = user.verificationTokens[0]
  if (!rec) {
    console.log('NO-TOKEN')
  } else {
    let code: string | null = null
    for (let n = 100000; n < 1000000; n++) {
      if (createHash('sha256').update(String(n)).digest('hex') === rec.tokenHash) {
        code = String(n)
        break
      }
    }
    console.log(code ?? 'NOT-FOUND')
  }
}

await db.$disconnect()
