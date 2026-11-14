// Jembatan ke modul native Android (alarm layar penuh & widget).
import { requireOptionalNativeModule } from 'expo';

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
};

const mod = requireOptionalNativeModule<Native>('UrwahNative');

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
};
