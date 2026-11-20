/**
 * Фирменные декоративные элементы: логотип-сота, соты-узор, бейджи срочности.
 */
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { URGENCY_META, type Urgency } from '@/lib/agent'

export function HexLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <polygon
        points="24,3 42,13 42,35 24,45 6,35 6,13"
        fill="#E93A2D"
      />
      <polygon
        points="24,12 34,18 34,30 24,36 14,30 14,18"
        fill="#FF5A1F"
        opacity="0.92"
      />
      <polygon
        points="24,18 29,21.2 29,26.8 24,30 19,26.8 19,21.2"
        fill="#fff"
      />
    </svg>
  )
}

/** Декоративный фрагмент сот (шестиугольники) */
export function HoneycombDecor({ className }: { className?: string }) {
  const hex = (cx: number, cy: number, r: number) => {
    const pts: string[] = []
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i)
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
    }
    return pts.join(' ')
  }
  return (
    <svg viewBox="0 0 300 260" className={className} aria-hidden="true">
      <polygon points={hex(240, 40, 34)} fill="none" stroke="#E93A2D" strokeWidth="2" opacity="0.35" />
      <polygon points={hex(291, 66, 34)} fill="#FF5A1F" opacity="0.85" />
      <polygon points={hex(189, 66, 34)} fill="none" stroke="#FF5A1F" strokeWidth="2" opacity="0.5" />
      <polygon points={hex(240, 92, 34)} fill="none" stroke="#E93A2D" strokeWidth="2" opacity="0.2" />
    </svg>
  )
}

/**
 * Амбиент-фон приложения: точечная сетка-соты и два огромных «тёплых пятна»,
 * которые очень медленно плывут по экрану (только transform — композитинг на
 * GPU, ноль перерасчёта layout). Плюс пара парящих контуров-сот. Слой
 * фиксированный, pointer-events-none: клики проходят насквозь.
 */
export function AmbientBackdrop() {
  return (
    <div className="dot-grid pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="blob-a absolute -left-[10vw] -top-[22vh] h-[72vh] w-[72vw]"
        style={{ background: 'radial-gradient(closest-side, rgba(233, 58, 45, 0.09), transparent)' }}
      />
      <div
        className="blob-b absolute -bottom-[28vh] -right-[14vw] h-[82vh] w-[78vw]"
        style={{ background: 'radial-gradient(closest-side, rgba(255, 138, 76, 0.11), transparent)' }}
      />
      <svg
        className="animate-spin-slow absolute right-[5vw] top-[16vh] h-44 w-44 opacity-[0.09]"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="none" stroke="#E93A2D" strokeWidth="2.5" />
        <polygon points="50,20 76,35 76,65 50,80 24,65 24,35" fill="none" stroke="#FF5A1F" strokeWidth="2" opacity="0.7" />
      </svg>
      <svg
        className="float-slow absolute bottom-[14vh] left-[3vw] h-28 w-28 opacity-[0.08]"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="none" stroke="#FF5A1F" strokeWidth="2.5" />
      </svg>
    </div>
  )
}

export function UrgencyBadge({ urgency, note }: { urgency: Urgency; note?: string }) {
  const meta = URGENCY_META[urgency]
  const t = useT()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        meta.cls,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {note ?? t(meta.labelKey)}
    </span>
  )
}

/** Шестиугольный чип-аватар */
export function HexChip({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center text-white',
        className,
      )}
      style={{ clipPath: 'polygon(25% 3%, 75% 3%, 98% 50%, 75% 97%, 25% 97%, 2% 50%)' }}
    >
      {children}
    </div>
  )
}
