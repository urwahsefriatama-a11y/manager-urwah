// Shalat: hitung mundur ke waktu berikutnya, pengingat per waktu (Mati / Notifikasi / Adzan),
// adzan dari file pilihan Anda, senyap otomatis, pengingat Jumat, kiblat & masjid terdekat.
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon } from '../src/ui/Icon';
import { PressableScale } from '../src/ui/PressableScale';
import { FadeIn, GhostBtn, Header, Label, PrimaryBtn, Toggle } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { color, radius } from '../src/ui/theme';
import { getSetting, setSetting } from '../src/data/settings';
import {
  adzanFile,
  currentPlace,
  MODE_LABEL,
  nextPrayer,
  prayerMode,
  prayersFor,
  refreshLocation,
  schedulePrayerReminders,
  setPrayerMode,
  type PrayerKey,
  type PrayerMode,
} from '../src/lib/prayer';
import { ensurePermission, scheduleAt, CHANNEL_PRAYER } from '../src/lib/notify';
import { hhmm, longDate, pad } from '../src/lib/time';
import { native } from '../modules/urwah-native/src';

const ORDER: PrayerMode[] = ['off', 'notif', 'adzan'];

export default function Shalat() {
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [, force] = useState(0);
  const [locBusy, setLocBusy] = useState(false);
  const refresh = () => force((n) => n + 1);

  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(id);
  }, []);

  const all = prayersFor(now);
  const np = nextPrayer(now);
  const place = currentPlace();
  const left = Math.max(0, np.at - now);
  const clock = `${pad(Math.floor(left / 3600000))}:${pad(Math.floor((left % 3600000) / 60000))}`;
  const file = adzanFile();

  const apply = async () => {
    await schedulePrayerReminders();
    refresh();
  };

  const cycle = async (key: PrayerKey) => {
    const cur = prayerMode(key);
    let nx = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
    if (nx === 'adzan' && !file) {
      toast('Pilih file adzan dulu (di bawah) untuk mode Adzan.');
      nx = 'off';
    }
    if (nx !== 'off') await ensurePermission();
    setPrayerMode(key, nx);
    await apply();
  };

  const pickAdzan = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    const ext = (a.name.split('.').pop() || 'mp3').toLowerCase();
    const dest = new File(Paths.document, `adzan.${ext}`);
    try {
      if (dest.exists) dest.delete();
      await new File(a.uri).copy(dest);
      setSetting('adzan_uri', dest.uri);
      setSetting('adzan_name', a.name);
      toast('File adzan disimpan.');
      await apply();
    } catch (e) {
      toast(`Gagal menyimpan file: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const toggle = async (k: string, v: boolean) => {
    if (k === 'auto_silent' && v && !native.hasDndAccess()) {
      toast('Tanpa izin "Jangan Ganggu", HP masuk mode getar (bukan senyap penuh).');
    }
    setSetting(k, v ? '1' : '0');
    await apply();
  };

  const updateLoc = async () => {
    setLocBusy(true);
    const r = await refreshLocation();
    setLocBusy(false);
    setNow(Date.now());
    await schedulePrayerReminders();
    toast(r === 'ok' ? `Lokasi diperbarui: ${currentPlace().name}` : r === 'denied' ? 'Izin lokasi ditolak. Memakai lokasi terakhir.' : 'GPS belum bisa dibaca. Memakai lokasi terakhir.');
  };

  const tryIt = async () => {
    if (file && native.available) {
      native.playAdzan('Coba adzan', file);
      toast('Memutar adzan. Hentikan dari notifikasi.');
    } else {
      await ensurePermission();
      await scheduleAt(`Waktu ${np.name}`, `Contoh pengingat · ${place.name}`, Date.now() + 5000, CHANNEL_PRAYER);
      toast('Contoh pengingat muncul dalam 5 detik.');
    }
  };

  return (
    <Screen bg="shalat">
      <Header title="Shalat" icon="shalat" />
      <FadeIn>
        <T size={13} muted>{`${place.name} (otomatis) · ${longDate(now)} · metode Kemenag`}</T>
      </FadeIn>

      <FadeIn delay={60}>
        <Glass strong style={styles.hero}>
          <T size={12} weight="heavy" style={{ letterSpacing: 1.2, color: color.accentSoft }}>
            {`MENUJU ${np.name.toUpperCase()} · ${hhmm(np.at)}`}
          </T>
          <T pixel size={76} maxFontSizeMultiplier={1} style={{ marginTop: 14 }}>
            {clock}
          </T>
          <T size={14} muted style={{ marginTop: 10 }}>
            jam : menit lagi
          </T>
        </Glass>
      </FadeIn>

      <FadeIn delay={100}>
        <Glass style={styles.list}>
          {all.map((w, i) => {
            const isNext = w.key === np.key && w.at === np.at;
            const past = w.at < now && !isNext;
            const c = isNext ? '#FFFFFF' : past ? color.faint : 'rgba(255,255,255,0.88)';
            return (
              <View key={w.key} style={[styles.row, i === 0 ? { borderTopWidth: 0 } : null]}>
                <T size={15} weight={isNext ? 'heavy' : 'semibold'} style={{ flex: 1, color: c }}>
                  {w.name}
                </T>
                <T pixel size={22} maxFontSizeMultiplier={1} style={{ color: c }}>
                  {hhmm(w.at)}
                </T>
                {w.key === 'terbit' ? (
                  <View style={[styles.mode, { backgroundColor: 'transparent' }]}>
                    <T size={12} weight="heavy" muted>
                      Info
                    </T>
                  </View>
                ) : (
                  <PressableScale accessibilityLabel={`Ubah pengingat ${w.name}`} onPress={() => cycle(w.key as PrayerKey)} style={styles.mode}>
                    <T size={12} weight="heavy">
                      {MODE_LABEL[prayerMode(w.key as PrayerKey)]}
                    </T>
                  </PressableScale>
                )}
              </View>
            );
          })}
        </Glass>
      </FadeIn>

      <FadeIn delay={140} style={styles.duo}>
        <PressableScale accessibilityLabel="Arah kiblat" onPress={() => router.navigate('/kiblat')} style={styles.duoItem} depth={0.96}>
          <Glass style={styles.duoIn}>
            <Icon name="compass" size={28} />
            <T size={14} weight="heavy" style={{ marginTop: 10 }}>
              Kiblat
            </T>
            <T size={12} muted>
              Kompas arah Ka'bah
            </T>
          </Glass>
        </PressableScale>
        <PressableScale accessibilityLabel="Masjid terdekat" onPress={() => Linking.openURL(`https://www.google.com/maps/search/masjid/@${place.lat},${place.lon},16z`)} style={styles.duoItem} depth={0.96}>
          <Glass style={styles.duoIn}>
            <Icon name="map" size={28} />
            <T size={14} weight="heavy" style={{ marginTop: 10 }}>
              Masjid terdekat
            </T>
            <T size={12} muted>
              Buka di Google Maps
            </T>
          </Glass>
        </PressableScale>
      </FadeIn>

      <FadeIn delay={180}>
        <Label style={{ marginTop: 22, marginBottom: 10 }}>ADZAN</Label>
        <Glass style={styles.box}>
          <View style={styles.row0}>
            <View style={{ flex: 1 }}>
              <T size={15} weight="bold">
                {file ? getSetting('adzan_name') || 'File adzan' : 'Belum ada file adzan'}
              </T>
              <T size={12} muted style={{ marginTop: 3 }}>
                Pilih rekaman adzan yang Anda suka (MP3/M4A) dari HP. Diputar walau HP mode senyap.
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <GhostBtn label={file ? 'Ganti file' : 'Pilih file'} icon="file" onPress={pickAdzan} />
            </View>
            {file ? (
              <View style={{ flex: 1 }}>
                <GhostBtn label="Hentikan" icon="stop" onPress={() => native.stopAdzan()} />
              </View>
            ) : null}
          </View>
        </Glass>

        <Glass style={[styles.box, { marginTop: 12 }]}>
          {[
            ['auto_silent', 'Senyap otomatis saat shalat', `Mulai waktu shalat sampai ${getSetting('silent_min') || 20} menit, lalu kembali normal`],
            ['jumat', 'Pengingat Jumat', 'Kamis malam: Al-Kahfi · Jumat 11.00: bersiap ke masjid'],
            ['mosque_hint', 'Sarankan masjid terdekat', 'Notifikasi 10 menit sebelum waktu shalat'],
          ].map(([k, t, d], i) => (
            <View key={k} style={[styles.row, i === 0 ? { borderTopWidth: 0 } : null]}>
              <View style={{ flex: 1 }}>
                <T size={14} weight="heavy">
                  {t}
                </T>
                <T size={12} muted style={{ marginTop: 2 }}>
                  {d}
                </T>
              </View>
              <Toggle on={getSetting(k) === '1'} onChange={(v) => toggle(k, v)} label={t} />
            </View>
          ))}
          {getSetting('auto_silent') === '1' ? (
            <View style={styles.chips}>
              {['15', '20', '30', '45'].map((m) => (
                <PressableScale
                  key={m}
                  accessibilityLabel={`${m} menit`}
                  onPress={async () => {
                    setSetting('silent_min', m);
                    await apply();
                  }}
                  style={[styles.chip, (getSetting('silent_min') || '20') === m ? styles.chipOn : null]}
                >
                  <T size={13} weight="heavy" style={(getSetting('silent_min') || '20') === m ? { color: color.ink } : null}>{`${m} mnt`}</T>
                </PressableScale>
              ))}
            </View>
          ) : null}
          {getSetting('auto_silent') === '1' && !native.hasDndAccess() ? (
            <T size={12} weight="bold" style={{ color: '#FFE3C4', marginTop: 10 }} onPress={() => native.openDndSettings()}>
              Izinkan "Jangan Ganggu" agar benar-benar senyap ›
            </T>
          ) : null}
        </Glass>
      </FadeIn>

      <View style={{ marginTop: 14, gap: 10 }}>
        <PrimaryBtn label="Coba pengingat shalat" onPress={tryIt} />
        <GhostBtn label={locBusy ? 'Membaca lokasi…' : 'Perbarui lokasi'} icon="pin" onPress={updateLoc} disabled={locBusy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 16, borderRadius: radius.xl, padding: 20, alignItems: 'center' },
  list: { marginTop: 12, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  row0: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mode: { width: 96, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  duo: { flexDirection: 'row', gap: 12, marginTop: 12 },
  duoItem: { flex: 1, borderRadius: radius.lg },
  duoIn: { borderRadius: radius.lg, padding: 16 },
  box: { borderRadius: radius.lg, padding: 16 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  chipOn: { backgroundColor: '#FFFFFF' },
});
