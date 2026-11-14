package expo.modules.urwahnative

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

object AlarmScheduler {
  const val CHANNEL = "urwah_alarm_v1"
  const val ACTION_FIRE = "expo.modules.urwahnative.ALARM_FIRE"
  const val ACTION_DISMISS = "expo.modules.urwahnative.ALARM_DISMISS"
  const val ACTION_SNOOZE = "expo.modules.urwahnative.ALARM_SNOOZE"
  private const val PREFS = "urwah_alarms"
  private const val DAY = 24L * 60 * 60 * 1000

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun flags() = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  fun schedule(ctx: Context, id: String, at: Long, title: String, body: String, daily: Boolean) {
    val obj = JSONObject().put("at", at).put("title", title).put("body", body).put("daily", daily)
    prefs(ctx).edit().putString(id, obj.toString()).apply()
    setAlarm(ctx, id, at, title, body)
  }

  fun setAlarm(ctx: Context, id: String, at: Long, title: String, body: String) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val fire = receiverIntent(ctx, ACTION_FIRE, id, title, body)
    val show = PendingIntent.getActivity(ctx, id.hashCode(), launchIntent(ctx, id, title, body), flags())
    if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire)
    } else {
      am.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), fire)
    }
  }

  fun cancel(ctx: Context, id: String) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    am.cancel(receiverIntent(ctx, ACTION_FIRE, id, "", ""))
    prefs(ctx).edit().remove(id).apply()
    dismissNotification(ctx, id)
  }

  fun snooze(ctx: Context, id: String, minutes: Int) {
    dismissNotification(ctx, id)
    val base = id.removeSuffix("#snooze")
    val raw = prefs(ctx).getString(id, null) ?: prefs(ctx).getString(base, null) ?: lastFired(ctx, id)
    val obj = if (raw != null) JSONObject(raw) else JSONObject()
    val title = obj.optString("title", "Alarm")
    val body = obj.optString("body", "")
    val at = System.currentTimeMillis() + minutes * 60_000L
    // Tunda tidak mengubah jadwal harian asli: simpan dengan id khusus.
    schedule(ctx, "$base#snooze", at, title, body, false)
  }

  // Judul alarm sekali-bunyi tetap diingat setelah berbunyi, agar "Tunda" masih tahu judulnya.
  private fun lastFired(ctx: Context, id: String): String? =
    ctx.getSharedPreferences(PREFS + "_last", Context.MODE_PRIVATE).getString(id, null)

  fun dismissNotification(ctx: Context, id: String) {
    NotificationManagerCompat.from(ctx).cancel(id.hashCode())
  }

  /** Dipanggil saat alarm berbunyi: tampilkan notifikasi layar penuh + jadwalkan ulang yang harian. */
  fun onFire(ctx: Context, id: String, title: String, body: String) {
    val raw = prefs(ctx).getString(id, null)
    if (raw != null) {
      val obj = JSONObject(raw)
      if (obj.optBoolean("daily", false)) {
        var next = obj.optLong("at", System.currentTimeMillis()) + DAY
        while (next <= System.currentTimeMillis()) next += DAY
        schedule(ctx, id, next, title, body, true)
      } else {
        ctx.getSharedPreferences(PREFS + "_last", Context.MODE_PRIVATE).edit().putString(id, raw).apply()
        prefs(ctx).edit().remove(id).apply()
      }
    }
    ensureChannel(ctx)
    val full = PendingIntent.getActivity(ctx, id.hashCode(), launchIntent(ctx, id, title, body), flags())
    val n = NotificationCompat.Builder(ctx, CHANNEL)
      .setSmallIcon(ctx.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setFullScreenIntent(full, true)
      .setContentIntent(full)
      .addAction(0, "Tunda 10 mnt", receiverIntent(ctx, ACTION_SNOOZE, id, title, body))
      .addAction(0, "Matikan", receiverIntent(ctx, ACTION_DISMISS, id, title, body))
      .build()
    n.flags = n.flags or android.app.Notification.FLAG_INSISTENT
    try {
      NotificationManagerCompat.from(ctx).notify(id.hashCode(), n)
    } catch (e: SecurityException) {
      // Izin notifikasi belum diberikan.
    }
  }

  /** Setelah HP dinyalakan ulang: pasang lagi semua alarm. */
  fun restoreAll(ctx: Context) {
    val now = System.currentTimeMillis()
    for ((id, value) in prefs(ctx).all) {
      val obj = try { JSONObject(value as String) } catch (e: Exception) { continue }
      var at = obj.optLong("at", 0)
      val daily = obj.optBoolean("daily", false)
      if (at <= now) {
        if (!daily) { prefs(ctx).edit().remove(id).apply(); continue }
        while (at <= now) at += DAY
      }
      schedule(ctx, id, at, obj.optString("title", "Alarm"), obj.optString("body", ""), daily)
    }
  }

  private fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL) != null) return
    val ch = NotificationChannel(CHANNEL, "Alarm layar penuh", NotificationManager.IMPORTANCE_HIGH)
    val sound: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    ch.setSound(sound, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
    ch.enableVibration(true)
    ch.vibrationPattern = longArrayOf(0, 600, 400, 600, 400, 600)
    ch.lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    nm.createNotificationChannel(ch)
  }

  private fun receiverIntent(ctx: Context, action: String, id: String, title: String, body: String): PendingIntent {
    val i = Intent(ctx, AlarmReceiver::class.java).apply {
      this.action = action
      data = Uri.parse("urwah-alarm://" + Uri.encode(id) + "/" + action.substringAfterLast('_'))
      putExtra("id", id)
      putExtra("title", title)
      putExtra("body", body)
    }
    return PendingIntent.getBroadcast(ctx, (id + action).hashCode(), i, flags())
  }

  private fun launchIntent(ctx: Context, id: String, title: String, body: String): Intent {
    val uri = Uri.parse("managerurwah://alarm?id=" + Uri.encode(id) + "&title=" + Uri.encode(title) + "&body=" + Uri.encode(body))
    val i = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent()
    i.action = Intent.ACTION_VIEW
    i.data = uri
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return i
  }
}
