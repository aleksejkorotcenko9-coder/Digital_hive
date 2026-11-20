'use client'

/**
 * Шкала «Состояние пасеки» — как на референсе: дуга-градиент от красного
 * (низкий индекс — тревога) к зелёному (высокий индекс — отличное состояние),
 * маркер текущего индекса 0…10 и подпись состояния.
 * Индекс считается по статусам ульев: риск роения −3, «наблюдать» −1,5,
 * молчащий датчик влажности −0,5 (честно считается из данных, без подгонки).
 */
import { motion } from 'framer-motion'
import { useSpringText } from './DemoCharts'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface GaugeInfo {
  value: number // 0…10
  label: string
  tone: 'ok' | 'normal' | 'watch' | 'alert'
}

const TONE_TEXT: Record<GaugeInfo['tone'], string> = {
  ok: 'text-emerald-600',
  normal: 'text-emerald-600',
  watch: 'text-amber-600',
  alert: 'text-red-600',
}

/** Расчёт индекса пасеки из статусов ульев (level из hiveStatus). */
export function apiaryGauge(levels: Array<'risk' | 'watch' | 'ok'>, totalHives: number): GaugeInfo {
  const effective = Math.max(totalHives, levels.length, 1)
  let value = 10
  for (const lv of levels) {
    if (lv === 'risk') value -= 3
    else if (lv === 'watch') value -= 1.5
  }
  value = Math.max(0, Math.min(10, value))
  const ratio = value / 10
  let label = 'dash.gauge.ok'
  let tone: GaugeInfo['tone'] = 'ok'
  if (ratio < 0.35) {
    label = 'dash.gauge.alert'
    tone = 'alert'
  } else if (ratio < 0.6) {
    label = 'dash.gauge.watch'
    tone = 'watch'
  } else if (ratio < 0.85) {
    label = 'dash.gauge.normal'
    tone = 'normal'
  }
  void effective
  return { value: Math.round(value * 10) / 10, label, tone }
}

export function StatusGauge({ info, className }: { info: GaugeInfo; className?: string }) {
  const t = useT()
  // Дуга 240° (от -210° до +30°), радиус 54, центр 60/64
  const cx = 70
  const cy = 66
  const r = 54
  const startAngle = -210
  const endAngle = 30
  const span = endAngle - startAngle

  const polar = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const arc = (from: number, to: number) => {
    const a = polar(from)
    const b = polar(to)
    const large = Math.abs(to - from) > 180 ? 1 : 0
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
  }

  // сегменты: красный → оранжевый → жёлтый → зелёный — шкала отзеркалена:
  // слева низкий индекс (тревога), справа высокий (отличное состояние).
  // Маркер (стрелка) остаётся на своём месте — меняются только цвета дуги.
  const seg = span / 4
  const segments = [
    { from: startAngle, to: startAngle + seg, stroke: '#E93A2D' },
    { from: startAngle + seg, to: startAngle + seg * 2, stroke: '#F0A03B' },
    { from: startAngle + seg * 2, to: startAngle + seg * 3, stroke: '#8FBF3F' },
    { from: startAngle + seg * 3, to: endAngle, stroke: '#3BA55D' },
  ]

  const markerAngle = startAngle + span * (info.value / 10)
  const mp = polar(markerAngle)
  const markerColor =
    info.tone === 'alert' || info.tone === 'watch'
      ? info.tone === 'alert'
        ? '#E93A2D'
        : '#F0A03B'
      : '#3BA55D'

  // значение в центре — пружинный счётчик: число плавно докатывается
  const springValue = useSpringText(info.value, 1)

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg viewBox="0 0 140 96" className="w-full max-w-[220px]" aria-hidden="true">
        {/* фон дуги */}
        <path d={arc(startAngle, endAngle)} fill="none" stroke="#F0E4DC" strokeWidth="10" strokeLinecap="round" />
        {/* цветные сегменты */}
        {segments.map((s, i) => (
          <path
            key={i}
            d={arc(s.from, s.to)}
            fill="none"
            stroke={s.stroke}
            strokeWidth="10"
            strokeLinecap="butt"
            opacity="0.9"
          />
        ))}
        {/* маркер значения — плавно «едет» по дуге при смене индекса (spring) */}
        <motion.circle
          cx={mp.x}
          cy={mp.y}
          r="7"
          fill="#fff"
          stroke={markerColor}
          strokeWidth="3"
          animate={{ cx: mp.x, cy: mp.y }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        />
        <motion.circle
          cx={mp.x}
          cy={mp.y}
          r="2.5"
          fill={markerColor}
          animate={{ cx: mp.x, cy: mp.y }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        />
        {/* значение в центре */}
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-[#2A1A12]" fontSize="26" fontWeight="800">
          {springValue}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-gray-400" fontSize="9">
          {t('gauge.indexOutOf10')}
        </text>
      </svg>
      <p className={cn('mt-1 text-sm font-bold', TONE_TEXT[info.tone])}>{t(info.label)}</p>
    </div>
  )
}
