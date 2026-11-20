/**
 * Голосовой ввод в чате ИИ-агента.
 *
 * Два механизма:
 *  1. Web Speech API (Chrome, Edge, Яндекс.Браузер) — основной путь: браузерное
 *     распознавание речи с языком «ru-RU», текст появляется в поле ввода прямо
 *     во время разговора. Русский распознаётся отлично.
 *  2. Серверный запасной путь (Firefox и прочие без Web Speech): запись через
 *     MediaRecorder → WAV 16 бит PCM mono → base64 → /api/asr (распознавание
 *     речевым сервисом на сервере).
 *
 * Всё это только в браузере; SDK серверного распознавания живёт на сервере.
 */

/** Максимальная длительность одной записи, секунд (защита от «забытого» микрофона). */
export const VOICE_MAX_SECONDS = 30

/** Язык распознавания голосового ввода. */
export const VOICE_LANG = 'ru-RU'

/* ------------------------------------------------------------------ */
/* Web Speech API (нативное распознавание, основной путь)              */
/* ------------------------------------------------------------------ */

/** Минимальный набор полей распознавателя, который нам нужен. */
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechResultEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

export interface SpeechResultEventLike {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/** Конструктор Web Speech API, если браузер его поддерживает. */
export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/* ------------------------------------------------------------------ */
/* Серверный путь: MediaRecorder → WAV → base64                        */
/* ------------------------------------------------------------------ */

/** Есть ли в браузере всё нужное для записи и конвертации аудио. */
export function voiceInputSupported(): boolean {
  if (typeof window === 'undefined') return false
  const webkitCtx = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return (
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined' &&
    typeof (window.AudioContext ?? webkitCtx) !== 'undefined'
  )
}

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

/** Аудио-буфер (любая частота, каналы) → WAV 16 бит PCM mono → base64. */
export function audioBufferToWavBase64(buffer: AudioBuffer): string {
  const length = buffer.length
  // сводим все каналы в моно
  const mono = new Float32Array(length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) mono[i] += data[i] / buffer.numberOfChannels
  }
  const dataSize = length * 2
  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // размер fmt-чанка
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // моно
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, mono[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  // ArrayBuffer → base64 (порциями, чтобы не выйти за лимит аргументов)
  const u8 = new Uint8Array(ab)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/** Записанный blob → WAV base64. Бросает ошибку, если запись не декодируется. */
export async function blobToWavBase64(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer()
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    const audio = await ctx.decodeAudioData(ab)
    return audioBufferToWavBase64(audio)
  } finally {
    void ctx.close()
  }
}
