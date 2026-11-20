/**
 * Сид базы: запускается вручную командой `bun prisma/seed.ts` (или `npm run db:seed`).
 * Сами данные создаются идемпотентно, повторный запуск безопасен.
 */
import { ensureSeeded } from '../src/lib/bootstrap'
import { db } from '../src/lib/db'

ensureSeeded()
  .then(async () => {
    const [users, hives, sites] = await Promise.all([
      db.user.count(),
      db.hive.count(),
      db.migrationSite.count(),
    ])
    console.log(`Сид выполнен: пользователей ${users}, ульев ${hives}, площадок ${sites}`)
    await db.$disconnect()
  })
  .catch((e) => {
    console.error('Ошибка сида:', e)
    process.exit(1)
  })
