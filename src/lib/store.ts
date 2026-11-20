'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApiData, ReminderDto, SafeUser } from './api-types'
import type { Lang } from './i18n'

/** Город пасеки: от координат зависит погода на дашборде. */
export interface ApiaryCity {
  name: string
  lat: number
  lon: number
}

export type View =
  | 'dashboard'
  | 'agent'
  | 'migration'
  | 'data'
  | 'reminders'
  | 'map'
  | 'sensors'
  | 'history'
  | 'about'
export type RealStatus = 'idle' | 'loading' | 'ready' | 'error'
export type Theme = 'light' | 'dark' | 'system'
/** Режим дашборда: «Демо» — сценарные ульи с живой телеметрией, «real» — свои данные. */
export type DashMode = 'demo' | 'real'

/** Пасека демо стоит в поле у Белебея — погода по умолчанию берётся там же. */
export const DEFAULT_CITY: ApiaryCity = { name: 'Белебей', lat: 54.0265, lon: 55.7391 }

interface AppState {
  view: View
  hiveId: number
  chatPrefill: string | null
  /** Тема оформления: светлая, тёмная или системная. */
  theme: Theme
  /** Пользователь сессии; null — не выполнен вход. */
  user: SafeUser | null
  /** Проверка сессии на старте завершена. */
  authChecked: boolean
  /** Данные реального режима. */
  real: ApiData | null
  realStatus: RealStatus
  realError: string | null
  /** Напоминания пользователя (загружает хук useReminders). */
  reminders: ReminderDto[]
  /** Диалог профиля открыт. */
  profileOpen: boolean
  /** Режим дашборда: «Демо» (сценарные ульи) или «Мои данные» (телеметрия с карты). */
  mode: DashMode
  /** Язык интерфейса (выбирается в профиле). */
  lang: Lang
  /** Город пасеки: координаты для погоды (можно выбрать на карте). */
  city: ApiaryCity
  /** Декоративные пчёлки, пролетающие над интерфейсом (вкл/выкл в профиле). */
  bees: boolean

  setView: (v: View) => void
  setHive: (id: number) => void
  ask: (question: string) => void
  clearPrefill: () => void
  setTheme: (t: Theme) => void
  setLang: (l: Lang) => void
  setCity: (c: ApiaryCity) => void
  setBees: (v: boolean) => void
  setUser: (u: SafeUser | null) => void
  setAuthChecked: (v: boolean) => void
  setReminders: (r: ReminderDto[]) => void
  setProfileOpen: (v: boolean) => void
  setMode: (m: DashMode) => void
  loadReal: () => Promise<void>
  logout: () => Promise<void>
  initAuth: () => Promise<void>
}

/** Применяет тему к <html>: класс .dark с учётом системных настроек. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export const useAppState = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'dashboard',
      hiveId: 1,
      chatPrefill: null,
      theme: 'light',
      user: null,
      authChecked: false,
      real: null,
      realStatus: 'idle',
      realError: null,
      reminders: [],
      profileOpen: false,
      mode: 'demo',
      lang: 'ru',
      city: DEFAULT_CITY,
      bees: true,

      setView: (v) => set({ view: v }),
      setMode: (m) => set({ mode: m }),
      setHive: (id) => set({ hiveId: id }),
      setLang: (l) => set({ lang: l }),
      setCity: (c) => set({ city: c }),
      setBees: (v) => set({ bees: v }),
      ask: (question) => set({ view: 'agent', chatPrefill: question }),
      clearPrefill: () => set({ chatPrefill: null }),

      setTheme: (t) => {
        set({ theme: t })
        applyTheme(t)
      },

      setUser: (u) => set({ user: u }),
      setAuthChecked: (v) => set({ authChecked: v }),
      setReminders: (r) => set({ reminders: r }),
      setProfileOpen: (v) => set({ profileOpen: v }),

      loadReal: async () => {
        set({ realStatus: 'loading', realError: null })
        try {
          const res = await fetch('/api/data', { cache: 'no-store' })
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string }
            throw new Error(j.error ?? `HTTP ${res.status}`)
          }
          const data = (await res.json()) as ApiData
          // если выбранный улей отсутствует в базе — переключаем на первый
          const hiveNumbers = data.hives.map((h) => h.number)
          const patch: Partial<AppState> = { real: data, realStatus: 'ready' }
          if (hiveNumbers.length && !hiveNumbers.includes(get().hiveId)) {
            patch.hiveId = hiveNumbers[0]
          }
          set(patch)
        } catch (e) {
          set({
            realStatus: 'error',
            realError: e instanceof Error ? e.message : 'Не удалось загрузить данные',
          })
        }
      },

      logout: async () => {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
        set({ user: null, real: null, realStatus: 'idle', chatPrefill: null, view: 'dashboard', reminders: [], profileOpen: false })
      },

      initAuth: async () => {
        applyTheme(get().theme)
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' })
          const j = (await res.json()) as { user: SafeUser | null }
          set({ user: j.user, authChecked: true })
          if (j.user) {
            void get().loadReal()
          }
        } catch {
          set({ user: null, authChecked: true })
        }
      },
    }),
    {
      name: 'uley-app',
      partialize: (s) => ({ hiveId: s.hiveId, theme: s.theme, mode: s.mode, lang: s.lang, city: s.city, bees: s.bees }),
    },
  ),
)
