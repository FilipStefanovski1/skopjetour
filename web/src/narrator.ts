import type { DataLang } from './types'

/**
 * The tour guide's voice, spoken by the phone itself (Web Speech API): free, offline, no audio
 * files. Text is queued sentence by sentence because some browsers cut long utterances short.
 */

const FALLBACKS: Record<DataLang, string[]> = {
  // No phone ships a Macedonian voice everywhere; the closest South Slavic voices read Cyrillic well.
  mk: ['mk', 'sr', 'bg', 'hr', 'bs'],
  en: ['en-GB', 'en-US', 'en'],
}

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

function voices(): SpeechSynthesisVoice[] {
  return canSpeak ? speechSynthesis.getVoices() : []
}

/** Best voice for the language, or null if the phone has none that fits. */
export function pickVoice(lang: DataLang): SpeechSynthesisVoice | null {
  const all = voices()
  for (const code of FALLBACKS[lang]) {
    const exact = all.filter((v) => v.lang.toLowerCase().startsWith(code.toLowerCase()))
    if (exact.length) return exact.find((v) => /natural|enhanced|premium|google/i.test(v.name)) ?? exact[0]
  }
  return null
}

/** Voices load asynchronously on some browsers. */
export function voicesReady(): Promise<void> {
  if (!canSpeak || voices().length) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => resolve()
    speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1200)
  })
}

export interface Narration {
  stop: () => void
}

export function speak(text: string, voice: SpeechSynthesisVoice | null, lang: string, onEnd: () => void, onSentence?: (i: number) => void): Narration {
  speechSynthesis.cancel()
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]+["“”»]?|\S[^.!?…]*$/g) ?? [text]
  let stopped = false
  sentences.forEach((s, i) => {
    const u = new SpeechSynthesisUtterance(s.trim())
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? lang
    u.rate = 0.98
    u.onstart = () => onSentence?.(i)
    if (i === sentences.length - 1) u.onend = () => !stopped && onEnd()
    speechSynthesis.speak(u)
  })
  return {
    stop: () => {
      stopped = true
      speechSynthesis.cancel()
    },
  }
}
