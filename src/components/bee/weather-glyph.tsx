'use client'

/**
 * Иконка погоды по коду из API — общий для дашборда и карты пасеки.
 */
import { Cloud, CloudRain, CloudSun, Snowflake, Sun, Zap } from 'lucide-react'
import type { WeatherIconKind } from '@/lib/api-types'
import { cn } from '@/lib/utils'

export function WeatherGlyph({ kind, className }: { kind: WeatherIconKind; className?: string }) {
  const cls = cn('h-5 w-5', className)
  switch (kind) {
    case 'sun':
      return <Sun className={cn(cls, 'text-orange-400')} />
    case 'sun-cloud':
      return <CloudSun className={cn(cls, 'text-orange-400')} />
    case 'rain':
      return <CloudRain className={cn(cls, 'text-red-400')} />
    case 'snow':
      return <Snowflake className={cn(cls, 'text-sky-500')} />
    case 'storm':
      return <Zap className={cn(cls, 'text-amber-500')} />
    default:
      return <Cloud className={cn(cls, 'text-gray-400')} />
  }
}
