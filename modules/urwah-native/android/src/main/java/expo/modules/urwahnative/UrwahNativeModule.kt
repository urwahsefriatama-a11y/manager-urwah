package expo.modules.urwahnative

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Modul native Manager Urwah: alarm layar penuh (setAlarmClock) + data widget layar utama.
class UrwahNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("Context belum siap")

  override fun definition() = ModuleDefinition {
    Name("UrwahNative")

    Function("canScheduleExact") {
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (Build.VERSION.SDK_INT >= 31) am.canScheduleExactAlarms() else true
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= 31) {
        val i = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + context.packageName))
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(i)
      }
    }

    Function("scheduleAlarm") { id: String, atMs: Double, title: String, body: String, daily: Boolean ->
      AlarmScheduler.schedule(context, id, atMs.toLong(), title, body, daily)
    }

    Function("cancelAlarm") { id: String ->
      AlarmScheduler.cancel(context, id)
    }

    Function("stopRinging") { id: String ->
      AlarmScheduler.dismissNotification(context, id)
    }

    Function("snooze") { id: String, minutes: Int ->
      AlarmScheduler.snooze(context, id, minutes)
    }

    // Android 14+: izin notifikasi layar penuh (alarm tampil di atas layar kunci).
    Function("canFullScreen") {
      if (Build.VERSION.SDK_INT >= 34) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.canUseFullScreenIntent()
      } else true
    }

    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        val i = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + context.packageName))
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(i)
      }
    }

    // Layar alarm tampil di atas layar kunci & menyalakan layar selama alarm berbunyi.
    Function("showOverLock") { on: Boolean ->
      val act = appContext.currentActivity
      if (act != null && Build.VERSION.SDK_INT >= 27) {
        act.runOnUiThread {
          act.setShowWhenLocked(on)
          act.setTurnScreenOn(on)
        }
      }
    }

    Function("setWidgetData") { json: String ->
      UrwahWidget.save(context, json)
    }
  }
}
