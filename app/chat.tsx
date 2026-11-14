// Chat WhatsApp: template buatan sendiri dengan {nama}, {tanggal}, {waktu}, kirim sekarang atau dijadwalkan.
// App membuka WhatsApp dengan pesan siap kirim — Anda sendiri yang menekan kirim.
import { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon } from '../src/ui/Icon';
import { PressableScale } from '../src/ui/PressableScale';
import { Sheet } from '../src/ui/Sheet';
import { TimePicker } from '../src/ui/forms';
import { Chip, Empty, FadeIn, Field, GhostBtn, Header, Label, PrimaryBtn, RoundBtn } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { color, radius } from '../src/ui/theme';
import {
  addWaReminder,
  deleteTemplate,
  finishWaReminder,
  listTemplates,
  listWaReminders,
  normalizePhone,
  saveTemplate,
  type WaReminder,
  type WaTemplate,
} from '../src/data/extra';
import { ensurePermission } from '../src/lib/notify';
import { dayDateTime, hhmm, hourOfDay, longDate, nextAtWib, todayAtWib } from '../src/lib/time';

function fill(body: string, name: string, at: number) {
  return body.replace(/\{nama\}/g, name || '').replace(/\{tanggal\}/g, longDate(at)).replace(/\{waktu\}/g, hhmm(at));
}

async function openWa(phone: string, text: string) {
  const url = `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert('WhatsApp tidak terbuka', 'Pastikan WhatsApp terpasang di HP ini.');
    return false;
  }
}

export default function Chat() {
  const toast = useToast();
  const [tpls, setTpls] = useState<WaTemplate[]>([]);
  const [rems, setRems] = useState<WaReminder[]>([]);
  const [tplEdit, setTplEdit] = useState<{ id: string | null; name: string; body: string } | null>(null);
  const [compose, setCompose] = useState<WaTemplate | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [later, setLater] = useState(false);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [t, setT] = useState({ h: 9, m: 0 });

  const reload = useCallback(() => {
    setTpls(listTemplates());
    setRems(listWaReminders());
  }, []);
  useFocusEffect(reload);

  const when = () => (day === 'today' ? todayAtWib(t.h, t.m) : nextAtWib(t.h, t.m, todayAtWib(23, 59) + 60000));

  const openCompose = (tp: WaTemplate) => {
    setCompose(tp);
    setName('');
    setPhone('');
    setLater(false);
    setDay('today');
    setT({ h: (Math.floor(hourOfDay(Date.now())) + 1) % 24, m: 0 });
  };

  return (
    <Screen bg="tasks">
      <Header title="Chat WhatsApp" />

      {rems.length ? (
        <FadeIn>
          <Label style={{ marginBottom: 10 }}>TERJADWAL</Label>
          <View style={{ gap: 10, marginBottom: 22 }}>
            {rems.map((r) => (
              <Glass key={r.id} style={styles.rem}>
                <View style={{ flex: 1 }}>
                  <T size={15} weight="bold" numberOfLines={1}>
                    {r.contact_name}
                  </T>
                  <T size={12.5} muted numberOfLines={1}>
                    {`${dayDateTime(r.at)} · ${r.body}`}
                  </T>
                </View>
                <PressableScale
                  accessibilityLabel="Batalkan"
                  onPress={async () => {
                    await finishWaReminder(r, 'cancelled');
                    reload();
                  }}
                  style={styles.smallBtn}
                >
                  <Icon name="close" size={16} />
                </PressableScale>
                <PressableScale
                  accessibilityLabel="Kirim sekarang"
                  onPress={async () => {
                    if (await openWa(r.phone, r.body)) {
                      await finishWaReminder(r, 'sent');
                      reload();
                    }
                  }}
                  style={[styles.smallBtn, { backgroundColor: '#FFFFFF' }]}
                >
                  <Icon name="send" size={16} color={color.ink} />
                </PressableScale>
              </Glass>
            ))}
          </View>
        </FadeIn>
      ) : null}

      <View style={styles.rowHead}>
        <Label>TEMPLATE PESAN</Label>
        <RoundBtn icon="plus" label="Template baru" size={40} onPress={() => setTplEdit({ id: null, name: '', body: '' })} />
      </View>
      <T size={12.5} muted style={{ marginBottom: 12 }}>
        Pakai {'{nama}'}, {'{tanggal}'}, {'{waktu}'} — otomatis diisi saat mengirim. Tekan lama untuk mengubah.
      </T>
      {tpls.length === 0 ? <Empty icon="chat" text="Belum ada template." /> : null}
      <View style={{ gap: 10 }}>
        {tpls.map((tp, i) => (
          <FadeIn key={tp.id} delay={i * 40}>
            <PressableScale
              accessibilityLabel={`Pakai template ${tp.name}`}
              onPress={() => openCompose(tp)}
              onLongPress={() => setTplEdit({ id: tp.id, name: tp.name, body: tp.body })}
              style={styles.tplWrap}
              depth={0.96}
            >
              <Glass style={styles.tpl}>
                <View style={{ flex: 1 }}>
                  <T size={15} weight="bold">
                    {tp.name}
                  </T>
                  <T size={13} muted numberOfLines={2} style={{ marginTop: 3 }}>
                    {tp.body}
                  </T>
                </View>
                <Icon name="send" size={18} color={color.muted} />
              </Glass>
            </PressableScale>
          </FadeIn>
        ))}
      </View>

      <Sheet open={!!tplEdit} onClose={() => setTplEdit(null)} title={tplEdit?.id ? 'Ubah template' : 'Template baru'}>
        <Field value={tplEdit?.name ?? ''} onChangeText={(v) => setTplEdit((e) => (e ? { ...e, name: v } : e))} placeholder="Nama template" />
        <View style={{ height: 10 }} />
        <Field
          value={tplEdit?.body ?? ''}
          onChangeText={(v) => setTplEdit((e) => (e ? { ...e, body: v } : e))}
          placeholder="Assalamu'alaikum {nama}, …"
          multiline
        />
        <View style={styles.chips}>
          {['{nama}', '{tanggal}', '{waktu}'].map((k) => (
            <Chip key={k} label={k} onPress={() => setTplEdit((e) => (e ? { ...e, body: `${e.body}${e.body.endsWith(' ') || !e.body ? '' : ' '}${k}` } : e))} />
          ))}
        </View>
        <View style={{ marginTop: 14, gap: 10 }}>
          <PrimaryBtn
            label="Simpan template"
            disabled={!tplEdit?.name.trim() || !tplEdit?.body.trim()}
            onPress={() => {
              if (!tplEdit) return;
              saveTemplate(tplEdit.id, tplEdit.name.trim(), tplEdit.body.trim());
              setTplEdit(null);
              reload();
            }}
          />
          {tplEdit?.id ? (
            <GhostBtn
              label="Hapus template"
              icon="trash"
              onPress={() => {
                if (tplEdit.id) deleteTemplate(tplEdit.id);
                setTplEdit(null);
                reload();
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <Sheet open={!!compose} onClose={() => setCompose(null)} title={compose?.name ?? ''}>
        <Field value={name} onChangeText={setName} placeholder="Nama penerima" />
        <View style={{ height: 10 }} />
        <Field value={phone} onChangeText={setPhone} placeholder="Nomor WA, mis. 0812…" keyboardType="phone-pad" />
        <Glass style={styles.preview}>
          <T size={13.5} style={{ lineHeight: 20 }}>
            {compose ? fill(compose.body, name, later ? when() : Date.now()) : ''}
          </T>
        </Glass>
        <View style={styles.chips}>
          <Chip label="Kirim sekarang" on={!later} onPress={() => setLater(false)} />
          <Chip label="Ingatkan nanti" on={later} onPress={() => setLater(true)} />
        </View>
        {later ? (
          <>
            <View style={styles.chips}>
              <Chip label="Hari ini" on={day === 'today'} onPress={() => setDay('today')} />
              <Chip label="Besok" on={day === 'tomorrow'} onPress={() => setDay('tomorrow')} />
            </View>
            <TimePicker hour={t.h} minute={t.m} onChange={(h, m) => setT({ h, m })} />
          </>
        ) : null}
        <View style={{ marginTop: 14 }}>
          <PrimaryBtn
            label={later ? 'Jadwalkan' : 'Buka WhatsApp'}
            disabled={normalizePhone(phone).length < 9}
            onPress={async () => {
              if (!compose) return;
              if (!later) {
                if (await openWa(phone, fill(compose.body, name, Date.now()))) setCompose(null);
                return;
              }
              const at = when();
              if (at <= Date.now()) {
                toast('Jam itu sudah lewat. Pilih jam lain.');
                return;
              }
              await ensurePermission();
              await addWaReminder(name.trim() || phone, phone, fill(compose.body, name, at), at);
              setCompose(null);
              toast(`Diingatkan ${dayDateTime(at)}.`);
              reload();
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  rem: { borderRadius: radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  tplWrap: { borderRadius: radius.lg },
  tpl: { borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  preview: { borderRadius: radius.md, padding: 14, marginTop: 12 },
});
