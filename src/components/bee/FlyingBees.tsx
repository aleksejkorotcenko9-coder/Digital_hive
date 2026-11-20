'use client'

/**
 * Редко пролетающие пчёлки — как раньше их было три, но теперь с красивым
 * детализированным SVG (градиентное полосатое брюшко, пушистая грудка,
 * усики с глазками, жало, два слоя машущих крыльев в противофазе):
 *  — три пчелы пересекают экран с большими паузами (repeatDelay 22–40 с);
 *  — полёт по ломаной траектории с наклоном по ходу движения;
 *  — всё на transform/opacity (композитные свойства), крылья — чистый CSS;
 *  — в настройках профиля пчёлок можно включать и выключать (store.bees);
 *  — при prefers-reduced-motion пчёлки не запускаются вовсе.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { useAppState } from '@/lib/store'

function BeeSvg({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="32"
      height="29"
      viewBox="0 0 38 34"
      aria-hidden="true"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
    >
      <defs>
        <linearGradient id="bee-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD54F" />
          <stop offset="55%" stopColor="#F7B733" />
          <stop offset="100%" stopColor="#DE8B1F" />
        </linearGradient>
        <linearGradient id="bee-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EAF3FF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#BCD7F2" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="bee-thorax" cx="0.35" cy="0.3" r="1">
          <stop offset="0%" stopColor="#C98A3B" />
          <stop offset="60%" stopColor="#9C6420" />
          <stop offset="100%" stopColor="#7A4A12" />
        </radialGradient>
      </defs>

      {/* заднее крыло (машет в противофазе) */}
      <g className="bee-wings2" style={{ transformOrigin: '17px 10px' }}>
        <ellipse cx="13" cy="9.6" rx="7.2" ry="4" fill="url(#bee-wing)" opacity="0.6" transform="rotate(-24 13 9.6)" />
      </g>
      {/* переднее крыло */}
      <g className="bee-wings" style={{ transformOrigin: '20px 9px' }}>
        <ellipse cx="18.5" cy="8.2" rx="8.4" ry="4.6" fill="url(#bee-wing)" opacity="0.85" transform="rotate(-14 18.5 8.2)" />
        <ellipse cx="18.5" cy="8.2" rx="8.4" ry="4.6" fill="none" stroke="#9FBEE0" strokeWidth="0.7" opacity="0.5" transform="rotate(-14 18.5 8.2)" />
      </g>

      {/* брюшко с полосами */}
      <ellipse cx="12.5" cy="20" rx="9.2" ry="6.6" fill="url(#bee-body)" />
      <path d="M8.6 14.6c2 3.6 2 7.2 0 10.8" stroke="#6B3E10" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M13.4 14.2c2.1 3.8 2.1 7.8 0 11.6" stroke="#6B3E10" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M18 14.6c1.6 3.4 1.6 7 0 10.4" stroke="#6B3E10" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* блик на брюшке */}
      <ellipse cx="10.5" cy="16.8" rx="3.4" ry="1.7" fill="#FFE08A" opacity="0.55" transform="rotate(-18 10.5 16.8)" />
      {/* жало */}
      <path d="M3.6 20.6l-2.4 1 2.6 1.2" fill="#5A360C" />

      {/* пушистая грудка */}
      <circle cx="21.5" cy="19.4" r="5.4" fill="url(#bee-thorax)" />
      <circle cx="21.5" cy="19.4" r="5.4" fill="none" stroke="#6B3E10" strokeWidth="0.8" opacity="0.35" />
      {/* ворсинки грудки */}
      <g stroke="#E8B25C" strokeWidth="0.9" strokeLinecap="round" opacity="0.8">
        <path d="M17.4 16.6l-1.4-1.2" />
        <path d="M19 15.2l-0.8-1.6" />
        <path d="M21.2 14.4l-0.2-1.7" />
        <path d="M17 21.8l-1.6 0.8" />
      </g>

      {/* голова */}
      <circle cx="28.2" cy="18.6" r="3.6" fill="#4A3315" />
      <circle cx="29.4" cy="17.4" r="1.1" fill="#fff" opacity="0.9" />
      <circle cx="29.4" cy="17.4" r="0.55" fill="#2A1A12" />
      {/* усики */}
      <g stroke="#4A3315" strokeWidth="1.2" strokeLinecap="round" fill="none">
        <path d="M29.8 15.4c1.6-1.6 3.4-2.2 5-2" />
        <path d="M28.2 15c0.8-1.9 2.2-3.2 3.8-3.6" />
        <circle cx="35" cy="13.2" r="0.8" fill="#4A3315" stroke="none" />
        <circle cx="32.2" cy="11.2" r="0.8" fill="#4A3315" stroke="none" />
      </g>
      {/* лапки */}
      <g stroke="#5A360C" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M19.5 24.4l-1.8 3" />
        <path d="M22.5 24.8l-1 3.2" />
        <path d="M25.3 24l1.6 2.8" />
      </g>
    </svg>
  )
}

/** Три маршрута полёта — как в исходной версии (влево-вправо, с большими паузами). */
interface FlightPlan {
  x: string[]
  y: string[]
  rotate: number[]
  scale: number
  duration: number
  repeatDelay: number
  delay: number
  flip: boolean
}

const PLANS: FlightPlan[] = [
  {
    x: ['-6vw', '22vw', '48vw', '74vw', '106vw'],
    y: ['68vh', '52vh', '62vh', '44vh', '60vh'],
    rotate: [0, -6, 4, -5, 0],
    scale: 1,
    duration: 30,
    repeatDelay: 22,
    delay: 4,
    flip: false,
  },
  {
    x: ['106vw', '80vw', '55vw', '26vw', '-8vw'],
    y: ['22vh', '34vh', '24vh', '40vh', '30vh'],
    rotate: [0, 5, -4, 6, 0],
    scale: 0.85,
    duration: 38,
    repeatDelay: 30,
    delay: 14,
    flip: true,
  },
  {
    x: ['-8vw', '30vw', '60vw', '104vw'],
    y: ['12vh', '20vh', '10vh', '18vh'],
    rotate: [0, -4, 3, 0],
    scale: 0.72,
    duration: 26,
    repeatDelay: 40,
    delay: 32,
    flip: false,
  },
]

export function FlyingBees() {
  const reduced = useReducedMotion()
  const enabled = useAppState((s) => s.bees)
  if (reduced || !enabled) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" aria-hidden="true">
      {PLANS.map((p, i) => (
        <motion.div
          key={i}
          className="absolute left-0 top-0 will-change-transform"
          initial={{ x: p.x[0], y: p.y[0], rotate: p.rotate[0], scale: p.scale }}
          animate={{ x: p.x, y: p.y, rotate: p.rotate, scale: p.scale }}
          transition={{
            duration: p.duration,
            times: p.x.map((_, idx) => idx / (p.x.length - 1)),
            repeat: Infinity,
            repeatDelay: p.repeatDelay,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        >
          <div className="bee-bob">
            <BeeSvg flip={p.flip} />
          </div>
        </motion.div>
      ))}
    </div>
  )
}
