/**
 * Прямой SMTP-проб: 3 попытки отправки на адрес из скриншота пользователя.
 * Логируем полный ответ сервера Mail.ru и код ошибки каждой попытки.
 * Запуск: bun scripts/smtp-probe.ts <email>
 */
import nodemailer from 'nodemailer'

const to = process.argv[2] || 'tifox2009ivan@yandex.ru'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`=== SMTP probe → ${to} ===`)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now()
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.mail.ru',
        port: 465,
        secure: true,
        auth: { user: 'digitalhive@mail.ru', pass: 'bSERt2HcpVekPR0I0Qux' },
        tls: { minVersion: 'TLSv1.2' },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
      })
      const info = await transporter.sendMail({
        from: 'Цифровой улей <digitalhive@mail.ru>',
        to,
        subject: `Тест доставки ${attempt} — Цифровой улей`,
        text: `Проверка доставки, попытка ${attempt}. Код можно игнорировать: 123456`,
      })
      console.log(
        `[${attempt}/3] OK за ${Date.now() - t0}мс messageId=${info.messageId} accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)}`,
      )
      return
    } catch (e) {
      const err = e as { code?: string; responseCode?: number; response?: string; message?: string }
      console.error(
        `[${attempt}/3] FAIL за ${Date.now() - t0}мс code=${err.code} responseCode=${err.responseCode} response=${err.response} message=${err.message}`,
      )
      if (attempt < 3) await sleep(1500)
    }
  }
  process.exit(1)
}

main()
