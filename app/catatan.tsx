// Catatan cepat + analisa AI (inti, poin penting, risiko, tugas).
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon } from '../src/ui/Icon';
import { Markdown } from '../src/ui/Markdown';
import { PressableScale } from '../src/ui/PressableScale';
import { Sheet } from '../src/ui/Sheet';
import { Empty, FadeIn, Field, GhostBtn, Header, PrimaryBtn, RoundBtn } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { color, radius } from '../src/ui/theme';
import { deleteNote, listNotes, saveNote, saveNoteAnalysis, type Note } from '../src/data/extra';
import { analyzeNote } from '../src/lib/ai';
import { hasKey } from '../src/lib/gemini';
import { shortDateTime } from '../src/lib/time';

export default function Catatan() {
  const toast = useToast();
  const params = useLocalSearchParams<{ isi?: string }>();
  const [notes, setNotes] = useState<Note[]>([]);
  const [edit, setEdit] = useState<{ id: string | null; title: string; body: string } | null>(null);
  const [view, setView] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    const list = listNotes();
    setNotes(list);
    setView((v) => (v ? list.find((n) => n.id === v.id) ?? null : v));
  }, []);
  useFocusEffect(reload);
  useFocusEffect(
    useCallback(() => {
      if (params.isi) setEdit({ id: null, title: 'Hasil pindai', body: params.isi });
    }, [params.isi]),
  );

  const analyze = async (n: Note) => {
    if (!(await hasKey())) {
      Alert.alert('Kunci Gemini belum diisi', 'Isi kunci Gemini di Pengaturan → Asisten AI.');
      return;
    }
    setBusy(true);
    try {
      saveNoteAnalysis(n.id, await analyzeNote(n.title, n.body));
      reload();
    } catch (e) {
      Alert.alert('Gagal menganalisa', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bg="tasks">
      <Header title="Catatan" right={<RoundBtn icon="plus" label="Catatan baru" size={44} onPress={() => setEdit({ id: null, title: '', body: '' })} />} />
      {notes.length === 0 ? <Empty icon="note" text="Belum ada catatan. Ketuk + untuk menulis." /> : null}
      <View style={{ gap: 10 }}>
        {notes.map((n, i) => (
          <FadeIn key={n.id} delay={i * 40}>
            <PressableScale accessibilityLabel={n.title} onPress={() => setView(n)} style={styles.itemWrap} depth={0.96}>
              <Glass style={styles.item}>
                <View style={{ flex: 1 }}>
                  <T size={15.5} weight="bold" numberOfLines={1}>
                    {n.title}
                  </T>
                  <T size={13} muted numberOfLines={2} style={{ marginTop: 3 }}>
                    {n.body}
                  </T>
                  <View style={styles.meta}>
                    <T size={11.5} muted>
                      {shortDateTime(n.updated_at)}
                    </T>
                    {n.analysis_md ? (
                      <View style={styles.badge}>
                        <Icon name="spark" size={11} color={color.ink} />
                        <T size={10.5} weight="heavy" style={{ color: color.ink }}>
                          Dianalisa
                        </T>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Icon name="chev" size={18} color={color.muted} />
              </Glass>
            </PressableScale>
          </FadeIn>
        ))}
      </View>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah catatan' : 'Catatan baru'}>
        <Field value={edit?.title ?? ''} onChangeText={(t) => setEdit((e) => (e ? { ...e, title: t } : e))} placeholder="Judul" />
        <View style={{ height: 10 }} />
        <Field value={edit?.body ?? ''} onChangeText={(t) => setEdit((e) => (e ? { ...e, body: t } : e))} placeholder="Tulis apa saja…" multiline />
        <View style={{ marginTop: 14 }}>
          <PrimaryBtn
            label="Simpan"
            disabled={!edit?.body.trim()}
            onPress={() => {
              if (!edit) return;
              saveNote(edit.id, edit.title.trim() || edit.body.trim().split('\n')[0].slice(0, 40), edit.body.trim());
              setEdit(null);
              toast('Catatan disimpan.');
              reload();
            }}
          />
        </View>
      </Sheet>

      <Sheet open={!!view} onClose={() => setView(null)} title={view?.title ?? ''}>
        {view ? (
          <View style={{ gap: 12 }}>
            <T size={14.5} style={{ lineHeight: 21 }} numberOfLines={10}>
              {view.body}
            </T>
            {view.analysis_md ? (
              <Glass style={styles.analysis}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  <Markdown text={view.analysis_md} size={14} />
                </ScrollView>
              </Glass>
            ) : null}
            {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
            <PrimaryBtn label={busy ? 'Menganalisa…' : view.analysis_md ? 'Analisa ulang' : 'Analisa dengan AI'} onPress={() => analyze(view)} disabled={busy} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <GhostBtn
                  label="Ubah"
                  icon="edit"
                  onPress={() => {
                    setEdit({ id: view.id, title: view.title, body: view.body });
                    setView(null);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <GhostBtn
                  label="Hapus"
                  icon="trash"
                  onPress={() =>
                    Alert.alert('Hapus catatan?', view.title, [
                      { text: 'Batal', style: 'cancel' },
                      { text: 'Hapus', style: 'destructive', onPress: () => { deleteNote(view.id); setView(null); reload(); } },
                    ])
                  }
                />
              </View>
            </View>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  itemWrap: { borderRadius: radius.lg },
  item: { borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  analysis: { borderRadius: radius.md, padding: 14, maxHeight: 340 },
});
