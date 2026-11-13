// Isian: pengatur jam, lembar tambah tugas, lembar tambah alarm.
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { T } from './T';
import { Chip, PrimaryBtn } from './bits';
import { color, font, radius } from './theme';
import { addTask } from '../data/tasks';
import { addAlarm } from '../data/alarms';
import { ensurePermission } from '../lib/notify';
import { hourOfDay, nextAtWib, pad } from '../lib/time';

function Stepper({ label, value, onUp, onDown }: { label: string; value: string; onUp: () => void; onDown: () => void }) {
  return (
    <View style={styles.col}>
      <PressableScale accessibilityLabel={`${label} naik`} onPress={onUp} style={styles.stepBtn}>
        <Icon name="plus" size={20} strokeWidth={2.6} />
      </PressableScale>
      <T pixel size={58} style={styles.num} maxFontSizeMultiplier={1}>
        {value}
      </T>
      <PressableScale accessibilityLabel={`${label} turun`} onPress={onDown} style={styles.stepBtn}>
        <Icon name="minus" size={20} strokeWidth={2.6} />
      </PressableScale>
      <T size={10} weight="heavy" muted style={{ letterSpacing: 1.4, marginTop: 6 }}>
        {label.toUpperCase()}
      </T>
    </View>
  );
}

export function TimePicker({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  return (
    <View style={styles.tp}>
      <Stepper label="Jam" value={pad(hour)} onUp={() => onChange((hour + 1) % 24, minute)} onDown={() => onChange((hour + 23) % 24, minute)} />
      <View style={styles.sep}>
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
      <Stepper label="Menit" value={pad(minute)} onUp={() => onChange(hour, (minute + 5) % 60)} onDown={() => onChange(hour, (minute + 55) % 60)} />
    </View>
  );
}

function defaultTime() {
  const h = Math.floor(hourOfDay(Date.now()) + 1) % 24;
  return { h, m: 0 };
}

export function AddTaskSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [title, setTitle] = useState('');
  const [withTime, setWithTime] = useState(false);
  const [t, setT] = useState(defaultTime());
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    let due: number | null = null;
    let permOk = true;
    if (withTime) {
      permOk = await ensurePermission();
      due = nextAtWib(t.h, t.m);
    }
    await addTask(name, due);
    setBusy(false);
    setTitle('');
    setWithTime(false);
    onClose();
    if (!withTime) onSaved('Tugas ditambahkan.');
    else if (!permOk) onSaved('Tugas disimpan, tapi izin notifikasi belum diberikan.');
    else onSaved(`Tugas ditambahkan. Diingatkan pukul ${pad(t.h)}:${pad(t.m)}.`);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Tugas baru">
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Contoh: Kirim proposal ke donatur"
        placeholderTextColor={color.faint}
        style={styles.input}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
        maxFontSizeMultiplier={1.3}
      />
      <View style={styles.row}>
        <Chip label="Tanpa jam" on={!withTime} onPress={() => setWithTime(false)} />
        <Chip label="Ingatkan di jam…" on={withTime} onPress={() => setWithTime(true)} />
      </View>
      {withTime ? <TimePicker hour={t.h} minute={t.m} onChange={(h, m) => setT({ h, m })} /> : null}
      <View style={{ marginTop: 16 }}>
        <PrimaryBtn label={busy ? 'Menyimpan…' : 'Simpan tugas'} onPress={save} disabled={!title.trim() || busy} />
      </View>
    </Sheet>
  );
}

const LABELS = ['Pengingat', 'Bangun', 'Tahajud', 'Rapat', 'Murajaah'];

export function AddAlarmSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [t, setT] = useState({ h: 4, m: 0 });
  const [label, setLabel] = useState('Pengingat');
  const [daily, setDaily] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await ensurePermission();
    await addAlarm(t.h, t.m, label, daily ? 'daily' : 'once');
    setBusy(false);
    onClose();
    onSaved(ok ? `Alarm ${pad(t.h)}:${pad(t.m)} disimpan.` : 'Alarm disimpan, tapi izin notifikasi belum diberikan.');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Alarm baru">
      <TimePicker hour={t.h} minute={t.m} onChange={(h, m) => setT({ h, m })} />
      <View style={[styles.row, { flexWrap: 'wrap', marginTop: 14 }]}>
        {LABELS.map((l) => (
          <Chip key={l} label={l} on={label === l} onPress={() => setLabel(l)} />
        ))}
      </View>
      <View style={[styles.row, { marginTop: 10 }]}>
        <Chip label="Sekali" on={!daily} onPress={() => setDaily(false)} />
        <Chip label="Setiap hari" on={daily} onPress={() => setDaily(true)} />
      </View>
      <View style={{ marginTop: 16 }}>
        <PrimaryBtn label={busy ? 'Menyimpan…' : 'Simpan alarm'} onPress={save} disabled={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 14 },
  col: { width: 104, alignItems: 'center' },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { marginVertical: 8, lineHeight: 64, textAlign: 'center', width: '100%' },
  sep: { gap: 14, marginBottom: 22 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.85)' },
  input: {
    fontFamily: font.regular,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 8 },
});
