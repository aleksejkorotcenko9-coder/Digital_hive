'use client'

/**
 * Клиентская обёртка локализации: словари и tr() живут в i18n-core.ts
 * (без 'use client' — чтобы серверные модули, например ИИ-агент,
 * могли вызывать tr на сервере). Здесь только хук useT.
 */
export { tr, LANGS, LANG_DATE_LOCALE, BASE_DICTS, EXTRA_MODULES, DICTS, type Dict, type Lang } from './i18n-core'

import { useCallback } from 'react'
import { useAppState } from './store'
import { tr } from './i18n-core'

/** Хук перевода для клиентских компонентов: t('key', {n: 1}). */
export function useT() {
  const lang = useAppState((s) => s.lang)
  return useCallback((key: string, vars?: Record<string, string | number>) => tr(lang, key, vars), [lang])
}
