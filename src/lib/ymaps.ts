/**
 * Яндекс Карты JS API 2.1 — загрузчик и минимальная типизация.
 *
 * Официальных типов нет (API подключается через CDN api-maps.yandex.ru,
 * без ключа, бесплатно для некоммерческого прототипа), поэтому здесь
 * описаны только те части API, которые реально использует «Карта пасеки».
 */

export type YmapsCoords = [number, number]

export interface YmapsEvent {
  get(key: string): unknown
}

export interface YmapsEventManager {
  add(type: string, handler: (e: YmapsEvent) => void): void
  remove(type: string, handler: (e: YmapsEvent) => void): void
}

export interface YmapsGeoObject {
  properties: { set(key: string, value: unknown): void; get(key: string): unknown }
  balloon: { open(): void; close(): void }
  events: YmapsEventManager
}

export interface YmapsGeoCollection {
  add(obj: YmapsGeoObject | YmapsGeoCollection): YmapsGeoCollection
  removeAll(): void
}

export interface YmapsGeocodeResult {
  geoObjects: {
    getLength(): number
    get(index: number): { properties: { get(key: string): unknown } } | null
  }
}

export interface YmapsCursorHandle {
  remove(): void
}

export interface YmapsMap {
  events: YmapsEventManager
  geoObjects: YmapsGeoCollection
  behaviors: { enable(name: string): void; disable(name: string): void }
  cursors: { push(name: string): YmapsCursorHandle }
  destroy(): void
  getZoom(): number
  setZoom(zoom: number): void
  /** Плавный перелёт к центру (анимация полёта). */
  panTo(center: YmapsCoords, options?: { duration?: number; flying?: boolean }): void
  setCenter(center: YmapsCoords, zoom?: number): void
  /** Подгоняет область просмотра под рамку [[юго-запад], [северо-восток]] —
   *  все точки в кадре; checkZoomRange не даёт перезумить дальше лимитов API. */
  setBounds(
    bounds: [YmapsCoords, YmapsCoords],
    options?: { checkZoomRange?: boolean; zoomMargin?: number; duration?: number },
  ): void
}

export interface YmapsApi {
  ready(handler?: () => void): { then(onFulfilled: () => void, onRejected?: (e: unknown) => void): unknown }
  Map: new (container: HTMLElement, state: Record<string, unknown>) => YmapsMap
  Placemark: new (
    coords: YmapsCoords,
    properties: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YmapsGeoObject
  GeoObjectCollection: new () => YmapsGeoCollection
  templateLayoutFactory: { createClass(template: string): unknown }
  /** Обратное геокодирование: координаты → ближайший адрес/город. */
  geocode(
    request: YmapsCoords | string,
    options?: { results?: number; kind?: string },
  ): Promise<YmapsGeocodeResult>
}

declare global {
  interface Window {
    ymaps?: YmapsApi
  }
}

const API_URL = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU'

let loader: Promise<YmapsApi> | null = null

/** Загружает Yandex Maps JS API 2.1 (один раз на страницу) и ждёт ymaps.ready(). */
export function loadYmaps(): Promise<YmapsApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('ymaps: доступно только в браузере'))
  }
  if (window.ymaps) return Promise.resolve(window.ymaps)
  if (loader) return loader

  loader = new Promise<YmapsApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = API_URL
    script.async = true
    script.onload = () => {
      const ym = window.ymaps
      if (!ym) {
        loader = null
        reject(new Error('ymaps: API не инициализировался'))
        return
      }
      ym.ready(() => resolve(ym))
    }
    script.onerror = () => {
      loader = null
      reject(new Error('Не удалось загрузить карту — проверьте соединение'))
    }
    document.head.appendChild(script)
  })
  return loader
}
