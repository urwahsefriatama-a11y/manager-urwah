// Pengaturan berkategori (daftar ke bawah → isi kategori).
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon, type IconName } from '../src/ui/Icon';
import { PressableScale } from '../src/ui/PressableScale';
import { FadeIn, Header, PrimaryBtn, Toggle } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { color, font, radius } from '../src/ui/theme';
import { getFlag, getSetting, resetSettings, setFlag, setSetting } from '../src/data/settings';
import { ensurePermission } from '../src/lib/notify';

type Cat = 'tampilan' | 'beranda' | 'pengingat' | 'asisten' | 'data';
const CATS: { key: Cat; label: string; desc: string; icon: IconName }[] = [
  { key: 'tampilan', label: 'Tampilan', desc: 'Nama, gerak, dan getar', icon: 'set' },
  { key: 'beranda', label: 'Beranda', desc: 'Bagian yang tampil di beranda', icon: 'home' },
  { key: 'pengingat', label: 'Pengingat & izin', desc: 'Notifikasi, alarm tepat waktu, baterai', icon: 'bell' },
  { key: 'asisten', label: 'Asisten & AI', desc: 'Kunci Gemini (disimpan terenkripsi)', icon: 'key' },
  { key: 'data', label: 'Data & versi', desc: 'Penyimpanan dan versi app', icon: 'file' },
];

const GEMINI_KEY = 'gemini_api_key';

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

function FlagRow({ k, title, sub }: { k: string; title: string; sub?: string }) {
  const [on, setOn] = useState(getFlag(k));
  return (
    <Row
      title={title}
      sub={sub}
      right={
        <Toggle
          on={on}
          label={title}
          onChange={(v) => {
            setFlag(k, v);
            setOn(v);
          }}
        />
      }
    />
  );
}

export default function Pengaturan() {
  const toast = useToast();
  const [cat, setCat] = useState<Cat | null>(null);
  const [name, setName] = useState(getSetting('name'));
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [notifOk, setNotifOk] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(GEMINI_KEY)
      .then((v) => setHasKey(!!v))
      .catch(() => setHasKey(false));
    Notifications.getPermissionsAsync()
      .then((p) => setNotifOk(p.granted))
      .catch(() => setNotifOk(null));
  }, [cat]);

  const current = CATS.find((c) => c.key === cat);

  return (
    <Screen bg="settings">
      <Header title={current ? current.label : 'Pengaturan'} />

      {!current ? (
        <FadeIn>
          <Glass style={{ paddingVertical: 4 }}>
            {CATS.map((c, i) => (
              <PressableScale key={c.key} accessibilityLabel={c.label} onPress={() => setCat(c.key)} style={[styles.catRow, i === 0 ? null : styles.divider]}>
                <View style={styles.catIcon}>
                  <Icon name={c.icon} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <T size={15} weight="bold">
                    {c.label}
                  </T>
                  <T size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>
                    {c.desc}
                  </T>
                </View>
                <Icon name="chev" size={16} color={color.faint} strokeWidth={2.4} />
              </PressableScale>
            ))}
          </Glass>
        </FadeIn>
      ) : (
        <FadeIn>
          <PressableScale accessibilityLabel="Semua pengaturan" onPress={() => setCat(null)} style={styles.backPill}>
            <Icon name="back" size={16} strokeWidth={2.4} />
            <T size={13} weight="bold">
              Semua pengaturan
            </T>
          </PressableScale>
          <T size={13} muted style={{ marginTop: 10, marginBottom: 12 }}>
            {current.desc}
          </T>

          {cat === 'tampilan' ? (
            <Glass style={styles.box}>
              <View style={[styles.row, { borderTopWidth: 0, flexDirection: 'column', alignItems: 'stretch' }]}>
                <T size={13} weight="bold" muted>
                  Nama panggilan di salam
                </T>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onEndEditing={() => {
                    setSetting('name', name.trim() || 'Urwah');
                    toast('Nama disimpan.');
                  }}
                  style={styles.input}
                  placeholder="Urwah"
                  placeholderTextColor={color.faint}
                  maxFontSizeMultiplier={1.3}
                />
              </View>
              <FlagRow k="reduce_motion" title="Kurangi gerak" sub="Matikan animasi untuk menghemat baterai" />
              <FlagRow k="haptic" title="Getar saat disentuh" />
            </Glass>
          ) : null}

          {cat === 'beranda' ? (
            <Glass style={styles.box}>
              <FlagRow k="home_prayer" title="Lintasan waktu shalat" />
              <FlagRow k="home_next" title="Pengingat berikutnya" sub="Judul besar: tugas/alarm terdekat" />
              <FlagRow k="home_todo" title="Tugas hari ini" />
              <FlagRow k="home_alarm" title="Alarm" />
            </Glass>
          ) : null}

          {cat === 'pengingat' ? (
            <>
              <Glass style={styles.box}>
                <Row
                  title="Izin notifikasi"
                  sub={notifOk ? 'Diizinkan.' : 'Belum diizinkan. Pengingat tidak akan muncul.'}
                  right={
                    notifOk ? (
                      <Icon name="check" size={20} color={color.ok} strokeWidth={2.6} />
                    ) : (
                      <T
                        size={13}
                        weight="bold"
                        style={{ color: '#FFE3C4' }}
                        accessibilityRole="button"
                        onPress={async () => {
                          const ok = await ensurePermission();
                          setNotifOk(ok);
                          if (!ok) Linking.openSettings();
                        }}
                      >
                        Izinkan
                      </T>
                    )
                  }
                />
                <Row
                  title="Alarm & pengingat tepat waktu"
                  sub="Android 12+ butuh izin ini agar bunyi tepat di menitnya. Bila pengingat terlambat, buka pengaturan app → Alarm & pengingat → izinkan."
                />
              </Glass>
              <Glass style={[styles.box, { marginTop: 12 }]}>
                <Row
                  title="Samsung: jangan tidurkan app"
                  sub="Pengaturan → Baterai → Batas penggunaan latar belakang → Aplikasi tidak pernah tidur → tambah Manager Urwah. Agar rekaman panjang & pengingat tidak dihentikan sistem."
                />
                <View style={{ paddingVertical: 12 }}>
                  <PrimaryBtn label="Buka pengaturan app" onPress={() => Linking.openSettings()} />
                </View>
              </Glass>
            </>
          ) : null}

          {cat === 'asisten' ? (
            <Glass style={styles.box}>
              <View style={[styles.row, { borderTopWidth: 0, flexDirection: 'column', alignItems: 'stretch' }]}>
                <T size={15} weight="bold">
                  Kunci Gemini
                </T>
                <T size={12} muted style={{ marginTop: 3, lineHeight: 17 }}>
                  {hasKey
                    ? 'Tersimpan terenkripsi di HP ini. Dipakai mulai versi 0.3 (transkrip & asisten).'
                    : 'Belum ada. Buat gratis di Google AI Studio, lalu tempel di sini. Tidak pernah dikirim ke tempat lain selain Google.'}
                </T>
                <TextInput
                  value={key}
                  onChangeText={setKey}
                  placeholder={hasKey ? '•••••••• (tersimpan)' : 'Tempel kunci di sini'}
                  placeholderTextColor={color.faint}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  maxFontSizeMultiplier={1.3}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryBtn
                      label="Simpan"
                      disabled={key.trim().length < 20}
                      onPress={async () => {
                        await SecureStore.setItemAsync(GEMINI_KEY, key.trim());
                        setKey('');
                        setHasKey(true);
                        toast('Kunci disimpan terenkripsi.');
                      }}
                    />
                  </View>
                  {hasKey ? (
                    <PressableScale
                      accessibilityLabel="Hapus kunci"
                      onPress={async () => {
                        await SecureStore.deleteItemAsync(GEMINI_KEY);
                        setHasKey(false);
                        toast('Kunci dihapus.');
                      }}
                      style={styles.delBtn}
                    >
                      <Icon name="trash" size={18} color={color.danger} />
                    </PressableScale>
                  ) : null}
                </View>
              </View>
            </Glass>
          ) : null}

          {cat === 'data' ? (
            <Glass style={styles.box}>
              <Row title="Semua data di HP ini" sub="Rekaman, tugas, alarm, dan pengaturan tidak dikirim ke server mana pun." />
              <Row title="Cadangan Google Drive" sub="Opsional, hadir di versi berikutnya." />
              <Row title="Versi app" right={<T pixel size={16}>{Constants.expoConfig?.version ?? '-'}</T>} />
              <View style={{ paddingVertical: 12 }}>
                <PressableScale
                  accessibilityLabel="Kembalikan pengaturan ke bawaan"
                  onPress={() => {
                    resetSettings();
                    setName(getSetting('name'));
                    toast('Pengaturan dikembalikan ke bawaan.');
                  }}
                  style={styles.resetBtn}
                >
                  <T size={13} weight="bold">
                    Kembalikan pengaturan ke bawaan
                  </T>
                </PressableScale>
              </View>
            </Glass>
          ) : null}
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  catIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  box: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  input: {
    marginTop: 10,
    fontFamily: font.regular,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  delBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(242,163,154,0.14)', alignItems: 'center', justifyContent: 'center' },
  resetBtn: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)' },
});
