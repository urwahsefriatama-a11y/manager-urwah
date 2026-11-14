// Semua tugas & alarm.
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { FadeIn, Header, Label, RoundBtn } from '../src/ui/bits';
import { AlarmRow, ProgressRing, TaskRow } from '../src/ui/lists';
import { AddAlarmSheet, AddTaskSheet } from '../src/ui/forms';
import { useToast } from '../src/ui/Toast';
import { updateWidget } from '../src/lib/widget';
import { deleteTask, listTasks, toggleTask, type Task } from '../src/data/tasks';
import { deleteAlarm, listAlarms, setAlarmEnabled, type Alarm } from '../src/data/alarms';
import { pad } from '../src/lib/time';

export default function Tugas() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [addTask, setAddTask] = useState(false);
  const [addAlarm, setAddAlarm] = useState(false);

  const reload = useCallback(() => {
    setTasks(listTasks());
    setAlarms(listAlarms());
    updateWidget();
  }, []);
  useFocusEffect(reload);

  const done = tasks.filter((t) => t.status === 'done').length;

  return (
    <Screen bg="tasks">
      <Header title="Tugas & Alarm" />
      <FadeIn>
        <Glass style={styles.section}>
          <View style={styles.head}>
            <ProgressRing done={done} total={tasks.length} size={84} />
            <View style={{ flex: 1 }}>
              <Label>PROGRES</Label>
              <T size={17} weight="heavy" style={{ marginTop: 6 }}>
                {tasks.length === 0 ? 'Belum ada tugas' : done === tasks.length ? 'Semua selesai. Alhamdulillah!' : `${tasks.length - done} tugas lagi`}
              </T>
              <T size={12} muted style={{ marginTop: 4 }}>
                Lingkaran ikut berubah saat Anda mencentang.
              </T>
            </View>
            <RoundBtn icon="plus" label="Tambah tugas" onPress={() => setAddTask(true)} size={40} />
          </View>
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={async () => {
                await toggleTask(t);
                reload();
              }}
              onDelete={async () => {
                await deleteTask(t);
                reload();
              }}
            />
          ))}
        </Glass>
      </FadeIn>

      <FadeIn delay={80}>
        <Glass style={styles.section}>
          <View style={[styles.head, { marginBottom: 4 }]}>
            <View style={{ flex: 1 }}>
              <Label>ALARM</Label>
              <T size={12} muted style={{ marginTop: 4 }}>
                Ketuk untuk nyala/mati · tahan untuk hapus
              </T>
            </View>
            <RoundBtn icon="plus" label="Tambah alarm" onPress={() => setAddAlarm(true)} size={40} />
          </View>
          {alarms.length === 0 ? (
            <T size={14} muted style={{ paddingVertical: 10 }}>
              Belum ada alarm.
            </T>
          ) : (
            alarms.map((a) => (
              <AlarmRow
                key={a.id}
                alarm={a}
                onToggle={async (on) => {
                  await setAlarmEnabled(a, on);
                  toast(on ? `Alarm ${pad(a.hour)}:${pad(a.minute)} menyala.` : `Alarm ${pad(a.hour)}:${pad(a.minute)} dimatikan.`);
                  reload();
                }}
                onDelete={async () => {
                  await deleteAlarm(a);
                  reload();
                }}
              />
            ))
          )}
        </Glass>
      </FadeIn>

      <AddTaskSheet open={addTask} onClose={() => setAddTask(false)} onSaved={(m) => { toast(m); reload(); }} />
      <AddAlarmSheet open={addAlarm} onClose={() => setAddAlarm(false)} onSaved={(m) => { toast(m); reload(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
});
