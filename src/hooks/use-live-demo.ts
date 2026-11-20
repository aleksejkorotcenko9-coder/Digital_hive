'use client'

/**
 * Живая телеметрия демо-режима: тик каждые 2 секунды, плавные реалистичные
 * колебания вокруг базовых значений сценария (mean reversion + случайный шаг):
 *   температура ±0,1 °C · влажность ±1 % · масса ±10–15 г ·
 *   гул ±3 Гц · CO₂ ±15 ppm · трафик ±3 пчелы/мин · заклещенность ±0,02 %.
 *
 * Значения зажаты в узкий коридор вокруг базы, поэтому цифры «дышат»,
 * но не уплывают. Тайминг ставится на паузу, когда вкладка скрыта
 * (document.hidden) — интерфейс не тратит ресурсы впустую.
 */
import { useEffect, useRef, useState } from 'react'
import { DEMO_HIVES, type DemoHive, type LiveDemoValues } from '@/lib/demo-hives'

/** Шаг и коридор колебаний по каждой метрике. */
const WOBBLE: Record<keyof Omit<LiveDemoValues, never>, { step: number; drift: number }> = {
  tempC: { step: 0.05, drift: 0.3 },
  humidityPct: { step: 0.5, drift: 2 },
  weightKg: { step: 0.006, drift: 0.06 }, // 6–15 г за тик, коридор ±60 г
  soundHz: { step: 1.4, drift: 6 },
  co2Ppm: { step: 7, drift: 40 },
  vocIndex: { step: 0.5, drift: 3 },
  trafficPerMin: { step: 1.4, drift: 6 },
  varroaPct: { step: 0.008, drift: 0.02 }, // живое колебание ±0,02 %
}

const METRICS = Object.keys(WOBBLE) as Array<keyof typeof WOBBLE>

export interface LiveTelemetry {
  /** Значения по ульям: id улья → живые показания. */
  values: Record<number, LiveDemoValues>
  /** Время последнего тика (мс) — для подписи «обновлено N с назад». */
  tickAt: number
  /** Буфер последних ~30 тиков для живого спарклайна выбранного улья. */
  spark: Record<number, LiveDemoValues[]>
}

function initialLive(): LiveTelemetry {
  const values: Record<number, LiveDemoValues> = {}
  const spark: Record<number, LiveDemoValues[]> = {}
  for (const h of DEMO_HIVES) {
    values[h.id] = { ...h.base }
    spark[h.id] = []
  }
  return { values, tickAt: Date.now(), spark }
}

/** Держит текущие значения в ref и копирует в state на каждом тике. */
export function useLiveTelemetry(): LiveTelemetry {
  const [state, setState] = useState<LiveTelemetry>(initialLive)
  const liveRef = useRef<LiveTelemetry>(state)

  useEffect(() => {
    const timer = setInterval(() => {
      // экономия ресурсов: на скрытой вкладке телеметрия замирает
      if (typeof document !== 'undefined' && document.hidden) return
      const prev = liveRef.current
      const values: Record<number, LiveDemoValues> = {}
      const spark: Record<number, LiveDemoValues[]> = {}
      for (const h of DEMO_HIVES) {
        const cur = prev.values[h.id] ?? h.base
        const next: Record<string, number> = {}
        // Зимой лёта нет: трафик ~0 не должен «гулять» на ±6 пчел/мин.
        const winterTraffic = h.base.trafficPerMin < 5
        for (const m of METRICS) {
          let { step, drift } = WOBBLE[m]
          if (winterTraffic && m === 'trafficPerMin') {
            step = 0.2
            drift = 0.5
          }
          const base = h.base[m]
          const curVal = cur[m]
          // возврат к базе + случайный шаг, зажатый в коридор ±drift
          const pull = (base - curVal) * 0.22
          const noise = (Math.random() - 0.5) * 2 * step
          let v = curVal + pull + noise
          if (Math.abs(v - base) > drift) v = base + Math.sign(v - base) * drift
          next[m] = Math.round(v * 1000) / 1000
        }
        values[h.id] = next as unknown as LiveDemoValues
        const buf = [...(prev.spark[h.id] ?? []), values[h.id]].slice(-30)
        spark[h.id] = buf
      }
      liveRef.current = { values, tickAt: Date.now(), spark }
      setState(liveRef.current)
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  return state
}

/** Живые значения выбранного улья (или база, пока тика нет). */
export function liveForHive(live: LiveTelemetry, hive: DemoHive): LiveDemoValues {
  return live.values[hive.id] ?? hive.base
}
