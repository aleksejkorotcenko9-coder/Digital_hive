'use client'

/**
 * Экран входа и регистрации.
 *
 * Подтверждение email сейчас ВЫКЛЮЧЕНО (EMAIL_VERIFICATION_REQUIRED = false в
 * src/lib/auth.ts): регистрация сразу возвращает пользователя и сессию —
 * попадаем в приложение без письма и кода. Вход работает для любых аккаунтов.
 *
 * Сценарий с кодом из письма сохранён: при включённой проверке сервер вернёт
 * ответ без user — откроется экран «Проверьте почту» (и 403 needsVerification
 * при входе в неподтверждённый аккаунт тоже ведёт на этот экран).
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { HexLogo, HoneycombDecor } from './decor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAppState } from '@/lib/store'
import { useT } from '@/lib/i18n'
import type { SafeUser } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import {
  Eye,
  EyeOff,
  Hexagon,
  LogIn,
  UserPlus,
  UserCog,
  MailCheck,
  MailWarning,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'

export type AuthNotice = { kind: 'success' | 'error'; text: string }

type Tab = 'login' | 'register'
type PendingEmail = { email: string; kind: 'registered' | 'unverified' }

const CODE_RE = /^\d{6}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RESEND_COOLDOWN_SEC = 60

export function AuthView({ notice: initialNotice, standalone }: { notice?: AuthNotice | null; standalone?: boolean }) {
  const router = useRouter()
  const t = useT()
  const [tab, setTab] = useState<Tab>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'BEEKEEPER' | 'HELPER'>('BEEKEEPER')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<AuthNotice | null>(initialNotice ?? null)

  // Состояния экрана «Проверьте почту»
  const [pendingEmail, setPendingEmail] = useState<PendingEmail | null>(null)
  const [pendingWarning, setPendingWarning] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [codeMsg, setCodeMsg] = useState<AuthNotice | null>(null)
  const [verifiedOk, setVerifiedOk] = useState(false)
  // Демо-фолбэк: сервер возвращает код вместе с отправкой письма, чтобы
  // регистрация не зависела от почтовых фильтров (Yandex прячет письма в «Спам»).
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)

  // Обратный отсчёт до повторной отправки кода
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setInterval(() => setResendIn((v) => (v > 0 ? v - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [resendIn])

  /** Открывает экран ввода кода (после регистрации или 403 при входе). */
  const showCodeScreen = (p: PendingEmail, warning?: string | null, code?: string | null) => {
    setPendingEmail(p)
    setPendingWarning(warning ?? null)
    setCodeInput('')
    setCodeMsg(null)
    setVerifiedOk(false)
    setDemoCode(code ?? null)
    setDemoOpen(false)
    setResendIn(RESEND_COOLDOWN_SEC) // пауза, чтобы письмо успело дойти
    setError(null)
  }

  const submit = async () => {
    if (busy) return
    if (tab === 'register' && !EMAIL_RE.test(email.trim())) {
      setError(t('auth.errEmail'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const url = tab === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload = tab === 'login' ? { name, password } : { name, email, password, role }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = (await res.json()) as {
        user?: SafeUser
        error?: string
        message?: string
        warning?: string
        needsVerification?: boolean
        email?: string
        demoCode?: string
      }

      // Вход в неподтверждённый аккаунт → сразу экран ввода кода
      // (актуально только при включённой проверке email)
      if (res.status === 403 && j.needsVerification && j.email) {
        showCodeScreen({ email: j.email, kind: 'unverified' })
        return
      }

      // Регистрация с отключённой проверкой почты: сервер сразу вернул
      // пользователя и сессию (cookie) — входим в приложение без письма.
      if (tab === 'register' && res.ok && j.user) {
        useAppState.getState().setUser(j.user)
        void useAppState.getState().loadReal()
        if (standalone) router.replace('/')
        return
      }

      if (tab === 'register' && res.ok) {
        // Проверка email включена: сессии нет, ждём код из письма.
        // demoCode — фолбэк для кнопки «Показать код», если письмо отфильтровано.
        showCodeScreen({ email: email.trim().toLowerCase(), kind: 'registered' }, j.warning ?? null, j.demoCode ?? null)
        return
      }

      if (!res.ok || !j.user) {
        setError(j.error ?? t('auth.errLogin'))
        return
      }
      useAppState.getState().setUser(j.user)
      void useAppState.getState().loadReal()
      // На отдельной странице /login после входа возвращаемся в приложение
      if (standalone) router.replace('/')
    } catch {
      setError(t('auth.errServer'))
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async () => {
    if (verifying || !pendingEmail) return
    const code = codeInput.replace(/\s+/g, '')
    if (!CODE_RE.test(code)) {
      setCodeMsg({ kind: 'error', text: t('auth.errCode') })
      return
    }
    setVerifying(true)
    setCodeMsg(null)
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail.email, code }),
      })
      const j = (await res.json()) as { message?: string; error?: string }
      if (!res.ok) {
        setCodeMsg({ kind: 'error', text: j.error ?? t('auth.errVerify') })
        return
      }
      setVerifiedOk(true) // зелёный экран «Email подтверждён» + кнопка «Войти в систему»
    } catch {
      setCodeMsg({ kind: 'error', text: t('auth.errServer') })
    } finally {
      setVerifying(false)
    }
  }

  const resendCode = async () => {
    if (resending || resendIn > 0 || !pendingEmail) return
    setResending(true)
    setCodeMsg(null)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail.email }),
      })
      const j = (await res.json()) as { message?: string; warning?: string; error?: string; demoCode?: string }
      if (!res.ok) {
        setCodeMsg({ kind: 'error', text: j.error ?? t('auth.errResend') })
        return
      }
      setPendingWarning(j.warning ?? null)
      setDemoCode(j.demoCode ?? null)
      setDemoOpen(false)
      setCodeMsg({ kind: 'success', text: t('auth.codeSent') })
      setResendIn(RESEND_COOLDOWN_SEC)
    } catch {
      setCodeMsg({ kind: 'error', text: t('auth.errServer') })
    } finally {
      setResending(false)
    }
  }

  /** Назад к форме входа (с экрана кода или после подтверждения). */
  const backToAuth = () => {
    setPendingEmail(null)
    setPendingWarning(null)
    setCodeInput('')
    setCodeMsg(null)
    setVerifiedOk(false)
    setTab('login')
    setError(null)
  }

  /* ---------------------------------------------------------------- */
  /* Экран «Проверьте почту» (код) и зелёный экран подтверждения       */
  /* ---------------------------------------------------------------- */
  if (pendingEmail) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#FAF6F3] via-[#F2EDFA] to-[#EDE4FB] px-4 py-10">
        <HoneycombDecor className="float-y pointer-events-none absolute -left-10 top-8 h-56 w-64 opacity-40" />
        <HoneycombDecor className="float-slow pointer-events-none absolute -right-12 bottom-6 h-64 w-72 opacity-30 rotate-180" />

        <div className="relative w-full max-w-md">
          <motion.div
            className="mb-6 flex flex-col items-center text-center"
            initial={{ opacity: 0, y: -18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <HexLogo className="h-16 w-16 drop-shadow-md" />
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#2A1A12]">{t('shell.appTitle')}</h1>
            <p className="mt-1 text-sm text-gray-500">{t('auth.tagline')}</p>
          </motion.div>

          <motion.div
            className="rounded-3xl border border-red-100 bg-white p-6 shadow-xl shadow-red-100/60"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {verifiedOk ? (
              /* Зелёный экран: email подтверждён */
              <div className="flex flex-col items-center py-4 text-center">
                <span className="pop-in flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <ShieldCheck className="h-9 w-9 text-green-600" />
                </span>
                <h2 className="mt-4 text-xl font-extrabold text-gray-900">{t('auth.emailVerified')}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {t('auth.activatedPre')} <span className="font-semibold text-gray-700">{pendingEmail.email}</span> {t('auth.activatedPost')}
                </p>
                <Button
                  onClick={backToAuth}
                  className="mt-5 h-11 w-full bg-red-600 text-base font-bold hover:bg-red-700"
                >
                  <LogIn className="h-4.5 w-4.5" /> {t('auth.loginBtn')}
                </Button>
              </div>
            ) : (
              /* Ввод кода из письма */
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void submitCode()
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100">
                    <MailCheck className="h-6 w-6 text-orange-600" />
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold text-gray-900">{t('auth.checkEmail')}</h2>
                    <p className="text-xs leading-snug text-gray-500">
                      {pendingEmail.kind === 'registered'
                        ? t('auth.codeSentTo')
                        : t('auth.unverifiedSentTo')}{' '}
                      <span className="font-semibold text-gray-700">{pendingEmail.email}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="auth-code" className="text-sm font-semibold text-gray-700">
                    {t('auth.codeLabel')}
                  </Label>
                  <Input
                    id="auth-code"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    className="border-red-200 text-center font-mono text-2xl tracking-[0.45em] focus-visible:ring-red-300"
                  />
                  <p className="text-xs text-gray-400">{t('auth.codeHint')}</p>
                </div>

                {pendingWarning && (
                  <p className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800">
                    <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
                    {pendingWarning}
                  </p>
                )}

                {codeMsg && (
                  <p
                    role="alert"
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm font-medium',
                      codeMsg.kind === 'success'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-red-200 bg-red-50 text-red-700',
                    )}
                  >
                    {codeMsg.text}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={verifying || codeInput.length !== 6}
                  className="h-11 w-full bg-orange-500 text-base font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  <Hexagon className={cn('h-4.5 w-4.5', verifying && 'animate-spin')} />
                  {verifying ? t('auth.verifying') : t('auth.verifyBtn')}
                </Button>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={backToAuth}
                    className="inline-flex items-center gap-1 font-bold text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> {t('auth.backToLogin')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void resendCode()}
                    disabled={resending || resendIn > 0}
                    className="inline-flex items-center gap-1.5 font-bold text-red-700 hover:text-red-900 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', resending && 'animate-spin')} />
                    {resendIn > 0 ? t('auth.resendIn', { n: resendIn }) : t('auth.resend')}
                  </button>
                </div>
              </form>
            )}
          </motion.div>

          <p className="mt-4 text-center text-xs text-gray-400">
            {t('auth.spamNote')}
          </p>

          {/* Демо-фолбэк: если письмо не дошло — код можно открыть прямо здесь */}
          {demoCode && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-xs font-bold text-amber-800">{t('auth.fallback.title')}</p>
              {!demoOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setDemoOpen(true)
                    setCodeInput(demoCode)
                  }}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-amber-700 underline underline-offset-2 hover:text-amber-900"
                >
                  <Eye className="h-3.5 w-3.5" /> {t('auth.fallback.show')}
                </button>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-amber-700">
                  <span className="mb-1 block text-xl font-extrabold tracking-[0.35em] text-amber-900">{demoCode}</span>
                  {t('auth.fallback.note')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /* Обычные формы входа и регистрации                                 */
  /* ---------------------------------------------------------------- */
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#FAF6F3] via-[#F2EDFA] to-[#EDE4FB] px-4 py-10">
      <HoneycombDecor className="float-y pointer-events-none absolute -left-10 top-8 h-56 w-64 opacity-40" />
      <HoneycombDecor className="float-slow pointer-events-none absolute -right-12 bottom-6 h-64 w-72 opacity-30 rotate-180" />

      <div className="relative w-full max-w-md">
        {/* Логотип — падает на место с пружиной */}
        <motion.div
          className="mb-6 flex flex-col items-center text-center"
          initial={{ opacity: 0, y: -18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <HexLogo className="h-16 w-16 drop-shadow-md" />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#2A1A12]">{t('shell.appTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('auth.tagline')}</p>
        </motion.div>

        {notice && (
          <p
            role="status"
            className={cn(
              'mb-4 rounded-2xl border px-4 py-3 text-sm font-medium',
              notice.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700',
            )}
          >
            {notice.text}
          </p>
        )}

        <motion.div
          className="rounded-3xl border border-red-100 bg-white p-6 shadow-xl shadow-red-100/60"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Переключатель — пилюля плавно переезжает между «Вход» и «Регистрация» */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-red-50 p-1">
            <button
              onClick={() => { setTab('login'); setError(null) }}
              className={cn(
                'relative flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors',
                tab === 'login' ? 'text-[#2A1A12]' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {tab === 'login' && (
                <motion.span
                  layoutId="auth-tab-pill"
                  className="absolute inset-0 rounded-xl bg-white shadow-sm"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <LogIn className="h-4 w-4" /> {t('auth.tabLogin')}
              </span>
            </button>
            <button
              onClick={() => { setTab('register'); setError(null) }}
              className={cn(
                'relative flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors',
                tab === 'register' ? 'text-[#2A1A12]' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {tab === 'register' && (
                <motion.span
                  layoutId="auth-tab-pill"
                  className="absolute inset-0 rounded-xl bg-white shadow-sm"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" /> {t('auth.tabRegister')}
              </span>
            </button>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="auth-name" className="text-sm font-semibold text-gray-700">{t('auth.nameLabel')}</Label>
              <Input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.namePh')}
                autoComplete="username"
                className="border-red-200 focus-visible:ring-red-300"
              />
            </div>

            {/* Email — только при регистрации: на него придёт код подтверждения */}
            {tab === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-sm font-semibold text-gray-700">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPh')}
                  autoComplete="email"
                  className="border-red-200 focus-visible:ring-red-300"
                />
                <p className="text-xs text-gray-400">{t('auth.emailNote')}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="auth-password" className="text-sm font-semibold text-gray-700">{t('auth.passwordLabel')}</Label>
              <div className="relative">
                <Input
                  id="auth-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === 'register' ? t('auth.passwordPh') : '••••••••'}
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  className="border-red-200 pr-10 focus-visible:ring-red-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Роль — только при регистрации */}
            {tab === 'register' && (
              <div className="space-y-2 rounded-2xl border border-red-100 bg-red-50/50 p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <UserCog className="h-4 w-4 text-red-600" /> {t('auth.roleTitle')}
                </p>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as 'BEEKEEPER' | 'HELPER')} className="gap-2">
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-xl border bg-white p-3 transition-colors',
                      role === 'BEEKEEPER' ? 'border-red-400 ring-2 ring-red-100' : 'border-red-100 hover:border-red-200',
                    )}
                  >
                    <RadioGroupItem value="BEEKEEPER" id="role-beekeeper" className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-bold text-gray-900">{t('profile.role.beekeeper')}</span>
                      <span className="block text-xs text-gray-500">{t('auth.roleBeekeeperDesc')}</span>
                    </span>
                  </label>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-xl border bg-white p-3 transition-colors',
                      role === 'HELPER' ? 'border-red-400 ring-2 ring-red-100' : 'border-red-100 hover:border-red-200',
                    )}
                  >
                    <RadioGroupItem value="HELPER" id="role-helper" className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-bold text-gray-900">{t('profile.role.helper')}</span>
                      <span className="block text-xs text-gray-500">{t('auth.roleHelperDesc')}</span>
                    </span>
                  </label>
                </RadioGroup>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={busy || !name.trim() || !password || (tab === 'register' && !email.trim())}
              className="h-11 w-full bg-red-600 text-base font-bold hover:bg-red-700 disabled:opacity-50"
            >
              <Hexagon className={cn('h-4.5 w-4.5', busy && 'animate-spin')} />
              {busy ? t('auth.wait') : tab === 'login' ? t('auth.loginBtn') : t('auth.registerBtn')}
            </Button>
          </form>
        </motion.div>

        <p className="mt-4 text-center text-xs text-gray-400">
          {tab === 'register'
            ? t('auth.registerNote')
            : t('auth.loginNote')}
        </p>
      </div>
    </div>
  )
}
