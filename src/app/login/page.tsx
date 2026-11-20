/**
 * Страница входа /login — отдельный маршрут, куда ведут редиректы из письма
 * подтверждения (GET /api/auth/verify):
 *   • ?verified=true      → зелёный баннер «Email подтверждён. Теперь вы можете войти.»
 *   • ?error=invalid_token → красный баннер «Ссылка недействительна или истекла.
 *                            Запросите новое письмо.»
 * После успешного входа пользователь возвращается в приложение на «/».
 */
import { AuthView, type AuthNotice } from '@/components/bee/AuthView'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string | string[]; error?: string | string[] }>
}) {
  const sp = await searchParams
  let notice: AuthNotice | null = null
  if (sp.verified) {
    notice = { kind: 'success', text: 'Email подтверждён. Теперь вы можете войти.' }
  } else if (sp.error === 'invalid_token') {
    notice = { kind: 'error', text: 'Ссылка недействительна или истекла. Запросите новое письмо.' }
  }
  return <AuthView notice={notice} standalone />
}
