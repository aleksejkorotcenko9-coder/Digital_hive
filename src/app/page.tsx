'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/bee/AppShell'
import { DashboardView } from '@/components/bee/DashboardView'
import { AgentChatView } from '@/components/bee/AgentChat'
import { MigrationView } from '@/components/bee/MigrationView'
import { DataView } from '@/components/bee/DataView'
import { AboutView } from '@/components/bee/AboutView'
import { CalendarRemindersView } from '@/components/bee/CalendarRemindersView'
import { MapPointsView } from '@/components/bee/MapPointsView'
import { SensorsView } from '@/components/bee/SensorsView'
import { HistoryView } from '@/components/bee/HistoryView'
import { AuthView } from '@/components/bee/AuthView'
import { HexLogo } from '@/components/bee/decor'
import { useAppState } from '@/lib/store'

export default function Home() {
  const user = useAppState((s) => s.user)
  const authChecked = useAppState((s) => s.authChecked)
  const view = useAppState((s) => s.view)

  useEffect(() => {
    void useAppState.getState().initAuth()
  }, [])

  // Проверяем сессию — показываем нейтральный сплэш (совпадает с SSR, без гидрационных скачков)
  if (!authChecked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#FAF6F3]">
        {/* логотип в пульсирующем кольце-соте */}
        <div className="relative flex items-center justify-center">
          <span className="ping-ring absolute h-20 w-20 rounded-full border-2 border-red-300" />
          <HexLogo className="h-14 w-14 animate-pulse" />
        </div>
        <p className="text-sm font-medium text-gray-400">Проверяем вход в систему…</p>
        {/* пружинные точки-загрузка */}
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="dot-bounce h-2 w-2 rounded-full bg-red-400"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthView />
  }

  return (
    <AppShell>
      {/* Плавный пружинный переход между разделами */}
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        {view === 'dashboard' && <DashboardView />}
        {view === 'agent' && <AgentChatView />}
        {view === 'map' && <MapPointsView />}
        {view === 'sensors' && <SensorsView />}
        {view === 'history' && <HistoryView />}
        {view === 'migration' && <MigrationView />}
        {view === 'data' && <DataView />}
        {view === 'reminders' && <CalendarRemindersView />}
        {view === 'about' && <AboutView />}
      </motion.div>
    </AppShell>
  )
}
