/**
 * Письмо с кодом подтверждения email через SMTP (nodemailer).
 *
 * Настройки берутся из .env:
 *   EMAIL_SERVER_HOST / EMAIL_SERVER_PORT / EMAIL_SERVER_USER /
 *   EMAIL_SERVER_PASSWORD / EMAIL_FROM
 *
 * Страховка: значения SMTP зашиты ниже как фолбэк — если окружение пересоздано
 * и .env потерял блок (так уже случалось: песочница восстанавливает файлы из
 * снапшота), письмо всё равно уходит через рабочий аккаунт Mail.ru.
 * Переопределить значения можно в .env / .env.local.
 *
 * Пользователь вводит 6-значный код из письма прямо в приложении — переход
 * по ссылкам не требуется, поэтому домен в письме не нужен.
 * Если SMTP не настроен нигде (env + фолбэк) — dev-режим: код печатается
 * в консоль сервера. Регистрация при этом не ломается.
 */
import nodemailer, { type Transporter } from 'nodemailer'

const APP_NAME = 'Цифровой улей'

/** Рабочий SMTP-аккаунт проекта (эталон — upload/почта.txt). */
const SMTP_FALLBACK = {
  host: 'smtp.mail.ru',
  port: 465,
  user: 'digitalhive@mail.ru',
  pass: 'bSERt2HcpVekPR0I0Qux',
  from: 'Цифровой улей <digitalhive@mail.ru>',
}

const smtpHost = process.env.EMAIL_SERVER_HOST || SMTP_FALLBACK.host
const smtpPort = Number(process.env.EMAIL_SERVER_PORT) || SMTP_FALLBACK.port
const smtpUser = process.env.EMAIL_SERVER_USER || SMTP_FALLBACK.user
const smtpPass = process.env.EMAIL_SERVER_PASSWORD || SMTP_FALLBACK.pass
const smtpFrom = process.env.EMAIL_FROM || SMTP_FALLBACK.from

function isSmtpConfigured(): boolean {
  return Boolean(smtpHost && smtpFrom)
}

/**
 * Переиспользуемый транспорт с пулом соединений (1 соединение, до 100 писем).
 * Первое подключение к Mail.ru может быть оборвано сервером
 * (ESOCKET «socket disconnected before secure TLS connection was established»),
 * поэтому при сбое транспорт закрывается и создаётся заново при ретрае.
 * Тёплое соединение ускоряет повторные отправки и снижает шанс обрыва.
 */
let cachedTransporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // 465 — implicit TLS, 587 — STARTTLS
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
      // Mail.ru обрывает TLS-рукопожатие без явного минимального TLS 1.2
      tls: { minVersion: 'TLSv1.2' },
      pool: true,
      maxConnections: 1,
      maxMessages: 100,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
    })
  }
  return cachedTransporter
}

function resetTransporter(): void {
  try {
    cachedTransporter?.close()
  } catch {
    // игнорируем ошибки закрытия «полудохлого» сокета
  }
  cachedTransporter = null
}

/** HTML-письмо на русском: приветствие, пояснение, крупный код, примечания. */
function buildVerificationHtml(name: string, code: string): string {
  const greeting = name ? `Здравствуйте, ${name}!` : 'Здравствуйте!'
  return `<!DOCTYPE html>
<html lang="ru">
  <body style="margin:0; padding:0; background-color:#f4f1ee;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ee; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background-color:#ffffff; border-radius:16px; padding:40px 36px; font-family:Arial, Helvetica, sans-serif; color:#2a1a12;">
            <tr>
              <td style="font-size:20px; font-weight:bold; padding-bottom:16px;">
                ${APP_NAME}
              </td>
            </tr>
            <tr>
              <td style="font-size:16px; padding-bottom:12px;">
                ${greeting}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px; line-height:1.6; color:#555555; padding-bottom:24px;">
                Чтобы завершить регистрацию, введите этот код подтверждения в приложении:
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="font-size:34px; font-weight:bold; letter-spacing:10px; color:#c2410c; background-color:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:18px 16px; text-align:center;">${code}</div>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px; line-height:1.6; color:#555555; padding-bottom:20px;">
                Введите код в приложении на экране «Проверьте почту» и нажмите «Подтвердить email».
              </td>
            </tr>
            <tr>
              <td style="font-size:12px; color:#999999; border-top:1px solid #eeeeee; padding-top:16px;">
                Код действителен 30 минут. Если вы не регистрировались в «${APP_NAME}», просто проигнорируйте это письмо.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Текстовая версия письма (multipart) — улучшает доставляемость и читаемость без HTML. */
function buildVerificationText(name: string, code: string): string {
  const greeting = name ? `Здравствуйте, ${name}!` : 'Здравствуйте!'
  return [
    greeting,
    '',
    'Чтобы завершить регистрацию в «Цифровом улье», введите этот код подтверждения в приложении:',
    '',
    `    ${code}`,
    '',
    'Код действителен 30 минут.',
    'Если вы не регистрировались в «Цифровом улье», просто проигнорируйте это письмо.',
  ].join('\n')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type SendResult = 'sent' | 'dev-logged'

/**
 * Отправляет письмо с кодом подтверждения. Бросает исключение только после
 * четырёх неудачных SMTP-попыток (с задержками 1,5 / 4 / 8 с) — вызывающий
 * код решает, как реагировать.
 *
 * Ретраи нужны потому, что Mail.ru иногда обрывает ПЕРВОЕ TLS-рукопожатие
 * нового соединения (наблюдалось и воспроизводилось: «socket disconnected
 * before secure TLS connection was established») — вторая попытка проходит
 * штатно. Перед каждой новой попыткой пул соединений сбрасывается.
 */
export async function sendVerificationEmail(to: string, name: string, code: string): Promise<SendResult> {
  // SMTP не настроен — dev-fallback: печатаем код в консоль сервера.
  if (!isSmtpConfigured()) {
    console.log(`[email] SMTP не настроен, письмо НЕ отправлено. Код подтверждения для ${to}: ${code}`)
    return 'dev-logged'
  }

  const MAX_ATTEMPTS = 4
  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const transporter = getTransporter()
      const info = await transporter.sendMail({
        from: smtpFrom,
        to,
        subject: `Код подтверждения — ${APP_NAME}`,
        html: buildVerificationHtml(name, code),
        text: buildVerificationText(name, code),
        // Просим почтовый сервер прислать отчёт при отказе/задержке — придёт в ящик отправителя
        dsn: { notify: ['FAILURE', 'DELAY'], ret: 'HDRS' },
      })
      if (attempt > 1) console.log(`[email] отправка удалась с попытки ${attempt}`)
      console.log(`[email] письмо с кодом отправлено на ${to} (${info.messageId}). Код: ${code}`)
      return 'sent'
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[email] попытка ${attempt}/${MAX_ATTEMPTS} для ${to} не удалась: ${msg}`)
      // Обрыв соединения/сбой — сбрасываем пул, чтобы следующая попытка
      // открыла свежее соединение вместо «полудохлого» сокета.
      resetTransporter()
      if (attempt < MAX_ATTEMPTS) await sleep(attempt === 1 ? 1500 : attempt === 2 ? 4000 : 8000)
    }
  }
  throw lastErr
}
