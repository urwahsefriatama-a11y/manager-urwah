// "Pulau" di dalam app (dynamic island) — satu sumber keadaan untuk semua layar.
// Jenis: rec (merekam), proc (AI bekerja), next (pengingat dekat), shalat, nudge (sapaan asisten), done, chat.
// Saat app ditutup, keadaan yang sama ditampilkan lewat Live Update Android (lihat native.liveShow).
import { native } from '../../modules/urwah-native/src';

export type IslandType = 'rec' | 'proc' | 'next' | 'shalat' | 'nudge' | 'done' | 'chat';
export type IslandAction = { label: string; run: () => void };
export type IslandData = {
  type: IslandType;
  pill: string; // teks kapsul kecil
  right: string; // angka di kanan (jam / persen / durasi)
  kicker: string;
  title: string;
  sub: string;
  pct: number; // 0..100 bilah progres (−1 = sembunyikan)
  a?: IslandAction;
  b?: IslandAction;
};
export type IslandState = { data: IslandData | null; mode: 'hidden' | 'pill' | 'open' };

let state: IslandState = { data: null, mode: 'hidden' };
const subs = new Set<(s: IslandState) => void>();
// Pulau milik sistem (rekam/proses) lebih penting daripada pengingat otomatis.
const PRIORITY: Record<IslandType, number> = { rec: 5, proc: 4, done: 3, chat: 3, nudge: 2, shalat: 2, next: 1 };

function emit() {
  for (const f of subs) f(state);
}

export const island = {
  get: () => state,
  subscribe(f: (s: IslandState) => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
  /** Tampilkan / perbarui. `force` menimpa pulau berprioritas lebih tinggi. */
  show(data: IslandData, mode: 'pill' | 'open' = 'pill', force = false) {
    const cur = state.data;
    if (cur && !force && cur.type !== data.type && PRIORITY[cur.type] > PRIORITY[data.type] && state.mode !== 'hidden') return;
    state = { data, mode: state.data?.type === data.type && state.mode === 'open' ? 'open' : mode };
    emit();
  },
  update(patch: Partial<IslandData>) {
    if (!state.data) return;
    state = { ...state, data: { ...state.data, ...patch } };
    emit();
  },
  setMode(mode: IslandState['mode']) {
    if (!state.data && mode !== 'hidden') return;
    state = { ...state, mode };
    emit();
  },
  hide(type?: IslandType) {
    if (type && state.data?.type !== type) return;
    state = { data: state.data, mode: 'hidden' };
    emit();
    setTimeout(() => {
      if (state.mode === 'hidden') {
        state = { data: null, mode: 'hidden' };
        emit();
      }
    }, 700);
  },
};

/** Cerminkan ke Live Update sistem (tampil di Now Bar / bilah status saat app di latar). */
export function mirrorLive(id: string, d: { title: string; text: string; whenMs?: number; countdown?: boolean; progress?: number; shortText?: string; path?: string }) {
  native.liveShow({ id, ...d });
}
export function clearLive(id: string) {
  native.liveCancel(id);
}
