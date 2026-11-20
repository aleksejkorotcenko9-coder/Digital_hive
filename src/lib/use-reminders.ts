'use client'

/**
 * Хук напоминаний: загружает список из /api/reminders, раз в 45 секунд
 * проверяет наступившие напоминания и показывает оповещение
 * (тост приложения + системное браузерное уведомление, если разрешено).
 */
import { useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useAppState } from '@/lib/store'
import type { ReminderDto } from '@/lib/api-types'

const POLL_MS = 45_000

export function useReminders() {
  const { toast } = useToast()
  const notified = useRef<Set<string>>(new Set())

  const load = useCallback(async (): Promise<ReminderDto[]> => {
    try {
      const res = await fetch('/api/reminders', { cache: 'no-store' })
      if (!res.ok) return []
      const j = (await res.json()) as { reminders: ReminderDto[] }
      useAppState.getState().setReminders(j.reminders)
      return j.reminders
    } catch {
      return []
    }
  }, [])

  const markNotified = useCallback(async (id: string) => {
    await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notified: true }),
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    let alive = true

    const showNotification = (r: ReminderDto) => {
      const when = new Date(r.remindAt).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
      toast({
        title: 'Напоминание',
        description: `${r.text} (${when})`,
        variant: 'default',
        duration: 12000,
      })
      // Системное уведомление браузера — если пользователь дал разрешение
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Цифровой улей — напоминание', {
            body: `${r.text}\n${when}`,
            tag: `uley-reminder-${r.id}`,
          })
        } catch {
          // некоторые браузеры ограничивают конструктор — тост уже показан
        }
      }
    }

    const check = async () => {
      const user = useAppState.getState().user
      if (!user || !alive) return
      const list = await load()
      if (!alive) return
      const now = Date.now()
      for (const r of list) {
        const due = new Date(r.remindAt).getTime() <= now
        const fresh = !r.done && !r.notifiedAt && due && !notified.current.has(r.id)
        if (fresh) {
          notified.current.add(r.id)
          showNotification(r)
          void markNotified(r.id)
        }
      }
    }

    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [load, markNotified, toast])

  return { reload: load }
}

/** Просит разрешение на системные уведомления браузера (по клику пользователя). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const res = await Notification.requestPermission()
    return res === 'granted'
  } catch {
    return false
  }
}
