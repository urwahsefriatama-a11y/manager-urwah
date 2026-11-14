// Jembatan ke modul native Android: alarm, widget, Live Update, shalat, suara, tombol asisten, izin Google.
import { requireOptionalNativeModule } from 'expo';

type SpeechEvent = { type: 'ready' | 'begin' | 'level' | 'end' | 'error' | 'final' | 'partial'; text: string; value: number };
type Sub = { remove(): void };

type Native = {
  canScheduleExact(): boolean;
  openExactAlarmSettings(): void;
  scheduleAlarm(id: string, atMs: number, title: string, body: string, daily: boolean): void;
  cancelAlarm(id: string): void;
  stopRinging(id: string): void;
  snooze(id: string, minutes: number): void;
  setWidgetData(json: string): void;
  canFullScreen(): boolean;
  openFullScreenSettings(): void;
  showOverLock(on: boolean): void;
  liveShow(json: string): void;
  liveCancel(id: string): void;
  canPromote(): boolean;
  scheduleLive(id: string, atMs: number, title: string, leadMin: number): void;
  cancelLive(id: string): void;
  openNotificationSettings(): void;
  schedulePrayer(id: string, atMs: number, title: string, fileUri: string, silentMin: number): void;
  cancelPrayer(id: string): void;
  playAdzan(title: string, fileUri: string): void;
  stopAdzan(): void;
  hasDndAccess(): boolean;
  openDndSettings(): void;
  speechAvailable(): boolean;
  startListening(lang: string): void;
  stopListening(): void;
  cancelListening(): void;
  launchedByAssist(): boolean;
  openAssistantSettings(): void;
  googleAuthorize(scopes: string[]): Promise<string>;
  addListener(event: 'onSpeech', cb: (e: SpeechEvent) => void): Sub;
  addListener(event: 'onAssist', cb: () => void): Sub;
};

const mod = requireOptionalNativeModule<Native>('UrwahNative');
const noSub: Sub = { remove() {} };

export type { SpeechEvent };

export const native = {
  available: !!mod,
  canScheduleExact: () => (mod ? mod.canScheduleExact() : true),
  openExactAlarmSettings: () => mod?.openExactAlarmSettings(),
  scheduleAlarm: (id: string, atMs: number, title: string, body: string, daily: boolean) => mod?.scheduleAlarm(id, atMs, title, body, daily),
  cancelAlarm: (id: string) => mod?.cancelAlarm(id),
  stopRinging: (id: string) => mod?.stopRinging(id),
  snooze: (id: string, minutes: number) => mod?.snooze(id, minutes),
  canFullScreen: () => (mod ? mod.canFullScreen() : true),
  openFullScreenSettings: () => mod?.openFullScreenSettings(),
  showOverLock: (on: boolean) => mod?.showOverLock(on),
  setWidgetData: (data: Record<string, string>) => mod?.setWidgetData(JSON.stringify(data)),

  liveShow: (o: { id: string; title: string; text: string; whenMs?: number; countdown?: boolean; progress?: number; shortText?: string; timeoutMs?: number; path?: string }) =>
    mod?.liveShow(JSON.stringify({ whenMs: 0, countdown: true, progress: -1, shortText: '', timeoutMs: 0, path: '', ...o })),
  liveCancel: (id: string) => mod?.liveCancel(id),
  canPromote: () => (mod ? mod.canPromote() : false),
  scheduleLive: (id: string, atMs: number, title: string, leadMin = 30) => mod?.scheduleLive(id, atMs, title, leadMin),
  cancelLive: (id: string) => mod?.cancelLive(id),
  openNotificationSettings: () => mod?.openNotificationSettings(),

  schedulePrayer: (id: string, atMs: number, title: string, fileUri: string, silentMin: number) => mod?.schedulePrayer(id, atMs, title, fileUri, silentMin),
  cancelPrayer: (id: string) => mod?.cancelPrayer(id),
  playAdzan: (title: string, fileUri: string) => mod?.playAdzan(title, fileUri),
  stopAdzan: () => mod?.stopAdzan(),
  hasDndAccess: () => (mod ? mod.hasDndAccess() : false),
  openDndSettings: () => mod?.openDndSettings(),

  speechAvailable: () => (mod ? mod.speechAvailable() : false),
  startListening: (lang = 'id-ID') => mod?.startListening(lang),
  stopListening: () => mod?.stopListening(),
  cancelListening: () => mod?.cancelListening(),
  onSpeech: (cb: (e: SpeechEvent) => void): Sub => (mod ? mod.addListener('onSpeech', cb) : noSub),

  launchedByAssist: () => (mod ? mod.launchedByAssist() : false),
  openAssistantSettings: () => mod?.openAssistantSettings(),
  onAssist: (cb: () => void): Sub => (mod ? mod.addListener('onAssist', cb) : noSub),

  googleAuthorize: (scopes: string[]) => (mod ? mod.googleAuthorize(scopes) : Promise.reject(new Error('Modul native tidak tersedia.'))),
};
