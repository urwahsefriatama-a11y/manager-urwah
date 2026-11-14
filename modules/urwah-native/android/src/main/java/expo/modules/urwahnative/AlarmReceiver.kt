package expo.modules.urwahnative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      PrayerScheduler.ACTION_PRAYER -> { PrayerScheduler.onFire(context, intent); return }
      PrayerScheduler.ACTION_RESTORE -> { PrayerScheduler.restore(context); return }
      PrayerScheduler.ACTION_LIVE -> { PrayerScheduler.onLive(context, intent); return }
    }
    val id = intent.getStringExtra("id") ?: return
    val title = intent.getStringExtra("title") ?: "Alarm"
    val body = intent.getStringExtra("body") ?: ""
    when (intent.action) {
      AlarmScheduler.ACTION_FIRE -> AlarmScheduler.onFire(context, id, title, body)
      AlarmScheduler.ACTION_DISMISS -> AlarmScheduler.dismissNotification(context, id)
      AlarmScheduler.ACTION_SNOOZE -> AlarmScheduler.snooze(context, id, 10)
    }
  }
}
