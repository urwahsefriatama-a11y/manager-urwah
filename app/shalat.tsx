// Jadwal shalat hari ini (dihitung di HP dari lokasi), plus pengingat tiap waktu shalat.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { PrayerArc } from '../src/ui/PrayerArc';
import { FadeIn, Header, Label, Toggle } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { getFlag, setFlag } from '../src/data/settings';
import { currentPlace, fivePrayers, nextPrayer, prayersFor, refreshLocation, schedulePrayerReminders } from '../src/lib/prayer';
import { ensurePermission } from '../src/lib/notify';
import { hhmm, longDate, untilText } from '../src/lib/time';

export default function Shalat() {
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [notif, setNotif] = useState(getFlag('prayer_notif'));
  const [locState, setLocState] = useState<'idle' | 'busy'>('idle');

  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const all = prayersFor(now);
  const five = fivePrayers(now);
  const np = nextPrayer(now);
  const place = currentPlace();

  const toggleNotif = async (on: boolean) => {
    if (on && !(await ensurePermission())) {
      toast('Izin notifikasi belum diberikan.');
      return;
    }
    setFlag('prayer_notif', on);
    setNotif(on);
    await schedulePrayerReminders();
    toast(on ? 'Pengingat waktu shalat menyala.' : 'Pengingat waktu shalat dimatikan.');
  };

  const updateLoc = async () => {
    setLocState('busy');
    const r = await refreshLocation();
    setLocState('idle');
    setNow(Date.now());
    await schedulePrayerReminders();
    toast(r === 'ok' ? `Lokasi diperbarui: ${currentPlace().name}` : r === 'denied' ? 'Izin lokasi ditolak. Memakai lokasi terakhir.' : 'GPS belum bisa dibaca. Memakai lokasi terakhir.');
  };

  return (
    <Screen bg="shalat">
      <Header title="Waktu shalat" />
      <FadeIn>
        <T size={13} muted>{`${longDate(now)} · ${place.name}`}</T>
        <View style={{ marginTop: 10 }}>
          <PrayerArc prayers={five} now={now} nextKey={np.key} />
        </View>
        <Glass style={styles.hero}>
          <Label>{`MENUJU ${np.name.toUpperCase()}`}</Label>
          <T pixel size={64} style={{ marginTop: 10 }} maxFontSizeMultiplier={1}>
            {hhmm(np.at)}
          </T>
          <T size={14} muted style={{ marginTop: 8 }}>
            {untilText(np.at, now)}
          </T>
        </Glass>
      </FadeIn>

      <FadeIn delay={80}>
        <Glass style={styles.list}>
          {all.map((p) => {
            const isNext = p.key === np.key;
            return (
              <View key={p.key} style={styles.row}>
                <T size={15} weight={isNext ? 'heavy' : 'semibold'} style={{ flex: 1, color: isNext ? '#FFE3C4' : '#FFFFFF', opacity: p.key === 'terbit' ? 0.7 : 1 }}>
                  {p.name}
                </T>
                <T pixel size={22} maxFontSizeMultiplier={1} style={{ color: isNext ? '#FFE3C4' : '#FFFFFF' }}>
                  {hhmm(p.at)}
                </T>
              </View>
            );
          })}
        </Glass>
      </FadeIn>

      <FadeIn delay={140}>
        <Glass style={styles.list}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <T size={15} weight="bold">
                Ingatkan setiap waktu shalat
              </T>
              <T size={12} muted style={{ marginTop: 3 }}>
                Notifikasi dengan bunyi & getar
              </T>
            </View>
            <Toggle on={notif} onChange={toggleNotif} label="Ingatkan setiap waktu shalat" />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <T size={15} weight="bold">
                {place.name}
              </T>
              <T size={12} muted style={{ marginTop: 3 }}>
                Dihitung di HP · sudut Subuh 20°, Isya 18° (acuan Kemenag)
              </T>
            </View>
            <T size={13} weight="bold" style={{ color: '#FFE3C4' }} onPress={locState === 'busy' ? undefined : updateLoc} accessibilityRole="button">
              {locState === 'busy' ? 'Mencari…' : 'Perbarui'}
            </T>
          </View>
        </Glass>
        <T size={12} muted style={styles.note}>
          Adzan penuh, arah kiblat, masjid terdekat, dan mode senyap otomatis hadir di versi berikutnya.
        </T>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 14, padding: 18, alignItems: 'center' },
  list: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  note: { textAlign: 'center', marginTop: 14, lineHeight: 18, paddingHorizontal: 10 },
});
