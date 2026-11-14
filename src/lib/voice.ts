// Suara: dengar ucapan (pengenal suara bawaan Android, bahasa Indonesia), panggilan "Halo asisten",
// dan membacakan jawaban (expo-speech).
import * as Speech from 'expo-speech';
import { native, type SpeechEvent } from '../../modules/urwah-native/src';
import { getSetting } from '../data/settings';

type Handler = (e: SpeechEvent) => void;
let owner: Handler | null = null;
let sub: { remove(): void } | null = null;

function ensureSub() {
  if (sub) return;
  sub = native.onSpeech((e) => owner?.(e));
}

/** Mulai mendengar sekali (sampai pengguna diam). Satu pemilik pada satu waktu. */
export function listen(h: Handler) {
  ensureSub();
  owner = h;
  native.startListening('id-ID');
}

export function stopListen() {
  native.stopListening();
}

export function release(h?: Handler) {
  if (!h || owner === h) {
    owner = null;
    native.cancelListening();
  }
}

export function speechReady() {
  return native.available && native.speechAvailable();
}

// ---------- Panggilan "Halo asisten" (hanya saat app terbuka) ----------
const WAKE = /\b(halo|hallo|hai|hey|hei|oke|ok)\s+(asisten|assistant|asistan|manager)\b/i;
let wakeOn = false;
let wakeCb: (() => void) | null = null;
let restartT: ReturnType<typeof setTimeout> | null = null;

const wakeHandler: Handler = (e) => {
  if ((e.type === 'partial' || e.type === 'final') && WAKE.test(e.text)) {
    stopWake();
    wakeCb?.();
    return;
  }
  if (e.type === 'final' || e.type === 'error' || e.type === 'end') {
    if (!wakeOn) return;
    if (restartT) clearTimeout(restartT);
    // error 7 = tidak ada ucapan, 8 = pengenal sibuk: ulangi pelan-pelan agar hemat baterai
    restartT = setTimeout(() => wakeOn && listen(wakeHandler), e.type === 'error' && e.value === 8 ? 1500 : 400);
  }
};

export function wakeEnabled() {
  return getSetting('wake_word') === '1';
}

export function startWake(onWake: () => void) {
  if (!speechReady() || !wakeEnabled()) return;
  wakeCb = onWake;
  if (wakeOn) return;
  wakeOn = true;
  listen(wakeHandler);
}

export function stopWake() {
  wakeOn = false;
  if (restartT) clearTimeout(restartT);
  if (owner === wakeHandler) release(wakeHandler);
}

export function isWakeActive() {
  return wakeOn;
}

// ---------- Membacakan jawaban ----------
export function speakOn() {
  return getSetting('speak_reply') !== '0';
}

/** Bacakan teks (Markdown dibersihkan dulu). */
export function say(text: string, onDone?: () => void) {
  const clean = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_>`]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .slice(0, 1200);
  Speech.stop();
  Speech.speak(clean, { language: 'id-ID', rate: 1.02, onDone, onStopped: onDone, onError: () => onDone?.() });
}

export function hush() {
  Speech.stop();
}
