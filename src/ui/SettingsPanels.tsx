// Panel pengaturan: Google Drive & cadangan, Pulau & Live Update.
import { useState, type ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Glass } from './Glass';
import { T } from './T';
import { PressableScale } from './PressableScale';
import { GhostBtn, PrimaryBtn, Toggle } from './bits';
import { useToast } from './Toast';
import { color } from './theme';
import { getSetting, setSetting } from '../data/settings';
import { driveDisconnect, driveEnabled, driveListBackups, driveToken } from '../lib/google';
import { backupToDrive, restoreFromDrive, restoreFromPicker, shareBackup } from '../lib/backup';
import { schedulePrayerReminders } from '../lib/prayer';
import { syncOnceAlarms } from '../data/alarms';
import { island, mirrorLive, clearLive } from '../lib/island';
import { hhmm } from '../lib/time';
import { native } from '../../modules/urwah-native/src';

function Row({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <T size={15} weight="bold">
          {title}
        </T>
        {sub ? (
          <T size={12} muted style={{ marginTop: 3, lineHeight: 17 }}>
            {sub}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function DrivePanel() {
  const toast = useToast();
  const [on, setOn] = useState(driveEnabled());
  const [busy, setBusy] = useState('');

  const run = async (label: string, f: () => Promise<void>) => {
    setBusy(label);
    try {
      await f();
    } catch (e) {
      Alert.alert('Belum berhasil', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const afterRestore = async () => {
    await syncOnceAlarms();
    await schedulePrayerReminders();
    toast('Data dipulihkan. Buka ulang layar untuk melihat perubahan.');
  };

  return (
    <>
      <Glass style={styles.box}>
        <Row
          title={on ? 'Google Drive terhubung' : 'Google Drive belum terhubung'}
          sub={
            on
              ? 'Asisten bisa mencari & membaca file Drive Anda (hanya baca), dan menyimpan cadangan ke Drive.'
              : 'Setelah terhubung, asisten bisa mencari dan membaca dokumen Drive untuk mengerjakan tugas Anda.'
          }
        />
        <View style={{ gap: 10, paddingBottom: 14 }}>
          {on ? (
            <GhostBtn
              label="Putuskan"
              icon="close"
              onPress={() => {
                driveDisconnect();
                setOn(false);
              }}
            />
          ) : (
            <PrimaryBtn
              label={busy === 'connect' ? 'Menghubungkan…' : 'Hubungkan Google Drive'}
              disabled={!!busy}
              onPress={() =>
                run('connect', async () => {
                  await driveToken(true);
                  setOn(true);
                  toast('Google Drive terhubung.');
                })
              }
            />
          )}
        </View>
      </Glass>

      <Glass style={[styles.box, { marginTop: 12 }]}>
        <Row title="Cadangan data" sub="Tugas, alarm, catatan, transkrip, ringkasan, template WA, dan pengaturan. Audio rekaman tidak ikut (tetap di HP)." />
        <View style={{ gap: 10, paddingBottom: 14 }}>
          {on ? (
            <>
              <PrimaryBtn
                label={busy === 'up' ? 'Mengunggah…' : 'Cadangkan ke Drive sekarang'}
                disabled={!!busy}
                onPress={() =>
                  run('up', async () => {
                    const n = await backupToDrive();
                    toast(`Tersimpan di Drive: ${n}`);
                  })
                }
              />
              <GhostBtn
                label={busy === 'down' ? 'Memulihkan…' : 'Pulihkan dari Drive'}
                icon="refresh"
                disabled={!!busy}
                onPress={() =>
                  run('down', async () => {
                    const list = (await driveListBackups()).slice(0, 3);
                    if (!list.length) {
                      toast('Belum ada cadangan di Drive.');
                      return;
                    }
                    Alert.alert('Pulihkan cadangan?', 'Data di HP ini akan diganti isi cadangan.', [
                      ...list.map((f) => ({ text: f.name.replace('manager-urwah-cadangan-', '').replace('.db', ''), onPress: () => run('down', async () => { await restoreFromDrive(f.id); await afterRestore(); }) })),
                      { text: 'Batal', style: 'cancel' as const },
                    ]);
                  })
                }
              />
            </>
          ) : null}
          <GhostBtn label="Simpan cadangan ke tempat lain" icon="share" disabled={!!busy} onPress={() => run('share', shareBackup)} />
          <GhostBtn
            label="Pulihkan dari file"
            icon="file"
            disabled={!!busy}
            onPress={() =>
              Alert.alert('Pulihkan dari file?', 'Data di HP ini akan diganti isi cadangan.', [
                { text: 'Batal', style: 'cancel' },
                { text: 'Pilih file', onPress: () => run('file', async () => { if (await restoreFromPicker()) await afterRestore(); }) },
              ])
            }
          />
        </View>
      </Glass>

      <Glass style={[styles.box, { marginTop: 12 }]}>
        <Row
          title="Persiapan sekali (gratis)"
          sub={
            'Google mewajibkan app terdaftar sebelum boleh membuka Drive:\n' +
            '1. Buka console.cloud.google.com → buat proyek baru.\n' +
            '2. APIs & Services → Library → aktifkan “Google Drive API”.\n' +
            '3. OAuth consent screen → External → isi nama app & email Anda → tambahkan email Anda di “Test users”.\n' +
            '4. Credentials → Create credentials → OAuth client ID → Android.\n' +
            '   Package name: com.urwah.manager\n' +
            '   SHA-1: lihat catatan rilis di GitHub (tertulis di setiap rilis).\n' +
            '5. Kembali ke sini → Hubungkan Google Drive.'
          }
        />
      </Glass>
    </>
  );
}

export function IslandPanel() {
  const toast = useToast();
  const [pos, setPos] = useState(getSetting('island_pos') || 'center');
  const [live, setLive] = useState(getSetting('live_updates') !== '0');
  const promoted = native.canPromote();

  const test = () => {
    const at = Date.now() + 2 * 60000;
    island.show(
      { type: 'next', pill: 'Contoh pengingat', right: hhmm(at), kicker: 'Berikutnya · 2 mnt lagi', title: 'Contoh pengingat', sub: 'Juga dikirim ke bilah status (Live Update)', pct: 40 },
      'open',
      true,
    );
    mirrorLive('demo', { title: 'Contoh pengingat', text: `Pukul ${hhmm(at)} WIB`, whenMs: at, countdown: true, shortText: hhmm(at), path: '' });
    setTimeout(() => clearLive('demo'), 3 * 60000);
    toast('Kunci layar / lihat bilah status untuk melihat Live Update.');
  };

  return (
    <>
      <Glass style={styles.box}>
        <Row title="Posisi pulau" sub="Ikuti lubang kamera HP. Galaxy S25 Ultra: tengah." />
        <View style={styles.chips}>
          {[
            ['left', 'Kiri'],
            ['center', 'Tengah'],
            ['right', 'Kanan'],
          ].map(([k, l]) => (
            <PressableScale
              key={k}
              accessibilityLabel={l}
              onPress={() => {
                setSetting('island_pos', k);
                setPos(k);
              }}
              style={[styles.chip, pos === k ? styles.chipOn : null]}
            >
              <T size={13} weight="heavy" style={pos === k ? { color: color.ink } : null}>
                {l}
              </T>
            </PressableScale>
          ))}
        </View>
        <Row
          title="Live Update di bilah status"
          sub="Hitung mundur pengingat (30 menit sebelum), rekaman berjalan, dan proses AI tampil di bilah status & Now Bar saat app ditutup."
          right={
            <Toggle
              on={live}
              label="Live Update"
              onChange={(v) => {
                setSetting('live_updates', v ? '1' : '0');
                setLive(v);
              }}
            />
          }
        />
        <Row
          title={promoted ? 'Diizinkan sistem' : 'Tampil sebagai notifikasi berjalan'}
          sub={
            promoted
              ? 'HP mengizinkan Live Update dari app ini.'
              : 'Di One UI 8 (Android 16), bila belum muncul di Now Bar: Pengaturan → Notifikasi → izinkan “Notifikasi langsung/Live” untuk Manager Urwah. Di sebagian HP Samsung perlu: Opsi pengembang → “Live notifications for all apps”.'
          }
        />
        <View style={{ gap: 10, paddingBottom: 14 }}>
          <PrimaryBtn label="Coba pulau & Live Update" onPress={test} />
          <GhostBtn label="Buka pengaturan notifikasi app" icon="bell" onPress={() => native.openNotificationSettings()} />
        </View>
      </Glass>
    </>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  chips: { flexDirection: 'row', gap: 8, paddingBottom: 6 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  chipOn: { backgroundColor: '#FFFFFF' },
});
