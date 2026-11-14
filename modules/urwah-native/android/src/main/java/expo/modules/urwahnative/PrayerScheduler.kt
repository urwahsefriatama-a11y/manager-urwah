package expo.modules.urwahnative

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import androidx.core.content.ContextCompat

// Waktu shalat: adzan (file pilihan pemilik) dan mode senyap otomatis.
object PrayerScheduler {
  const val ACTION_PRAYER = "expo.modules.urwahnative.PRAYER_FIRE"
  const val ACTION_RESTORE = "expo.modules.urwahnative.RINGER_RESTORE"
  const val ACTION_LIVE = "expo.modules.urwahnative.LIVE_FIRE"
  private const val PREFS = "urwah_ringer"

  private fun flags() = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  private fun pi(ctx: Context, action: String, id: String, extras: (Intent) -> Unit): PendingIntent {
    val i = Intent(ctx, AlarmReceiver::class.java).apply {
      this.action = action
      data = Uri.parse("urwah-prayer://" + Uri.encode(id) + "/" + action.substringAfterLast('.'))
      putExtra("id", id)
      extras(this)
    }
    return PendingIntent.getBroadcast(ctx, (id + action).hashCode(), i, flags())
  }

  private fun setExact(ctx: Context, at: Long, p: PendingIntent) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p)
    else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p)
  }

  /** fileUri kosong = tanpa suara adzan (hanya senyap bila silentMin > 0). */
  fun schedule(ctx: Context, id: String, at: Long, title: String, fileUri: String, silentMin: Int) {
    setExact(ctx, at, pi(ctx, ACTION_PRAYER, id) {
      it.putExtra("title", title); it.putExtra("file", fileUri); it.putExtra("silent", silentMin)
    })
  }

  fun cancel(ctx: Context, id: String) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    am.cancel(pi(ctx, ACTION_PRAYER, id) {})
  }

  fun onFire(ctx: Context, intent: Intent) {
    val title = intent.getStringExtra("title") ?: "Waktu shalat"
    val file = intent.getStringExtra("file") ?: ""
    val silent = intent.getIntExtra("silent", 0)
    if (silent > 0) applySilent(ctx, silent)
    if (file.isNotEmpty()) startAdzan(ctx, title, file)
  }

  fun startAdzan(ctx: Context, title: String, file: String) {
    val i = Intent(ctx, AdzanService::class.java).apply {
      putExtra("title", title); putExtra("file", file)
    }
    try {
      ContextCompat.startForegroundService(ctx, i)
    } catch (e: Exception) {
      // Sistem menolak layanan latar: pengingat notifikasi tetap ada dari sisi JS.
    }
  }

  fun stopAdzan(ctx: Context) {
    ctx.stopService(Intent(ctx, AdzanService::class.java))
  }

  /** Mode getar selama shalat, lalu kembali seperti semula. */
  fun applySilent(ctx: Context, minutes: Int) {
    val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val current = am.ringerMode
    if (current == AudioManager.RINGER_MODE_NORMAL) {
      try {
        val target = if (hasDnd(ctx)) AudioManager.RINGER_MODE_SILENT else AudioManager.RINGER_MODE_VIBRATE
        am.ringerMode = target
        prefs.edit().putInt("prev", current).putInt("set", target).apply()
      } catch (e: SecurityException) {
        return
      }
    }
    setExact(ctx, System.currentTimeMillis() + minutes * 60_000L, pi(ctx, ACTION_RESTORE, "ringer") {})
  }

  fun restore(ctx: Context) {
    val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val prev = prefs.getInt("prev", -1)
    val set = prefs.getInt("set", -1)
    // Kembalikan hanya bila pemilik tidak mengubahnya sendiri selama shalat.
    if (prev >= 0 && am.ringerMode == set) {
      try { am.ringerMode = prev } catch (e: SecurityException) {}
    }
    prefs.edit().clear().apply()
  }

  fun hasDnd(ctx: Context): Boolean {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return nm.isNotificationPolicyAccessGranted
  }

  /** Pengingat menjelang acara: Live Update hitung mundur muncul `leadMs` sebelum waktunya. */
  fun scheduleLive(ctx: Context, id: String, at: Long, title: String, leadMs: Long) {
    val fireAt = maxOf(System.currentTimeMillis() + 1000, at - leadMs)
    setExact(ctx, fireAt, pi(ctx, ACTION_LIVE, id) {
      it.putExtra("title", title); it.putExtra("at", at)
    })
  }

  fun cancelLive(ctx: Context, id: String) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    am.cancel(pi(ctx, ACTION_LIVE, id) {})
    LiveUpdates.cancel(ctx, "live:$id")
  }

  fun onLive(ctx: Context, intent: Intent) {
    val id = intent.getStringExtra("id") ?: return
    val title = intent.getStringExtra("title") ?: "Pengingat"
    val at = intent.getLongExtra("at", 0)
    val left = at - System.currentTimeMillis()
    if (left <= 0) return
    val cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("Asia/Jakarta"))
    cal.timeInMillis = at
    val hhmm = String.format("%02d:%02d", cal.get(java.util.Calendar.HOUR_OF_DAY), cal.get(java.util.Calendar.MINUTE))
    LiveUpdates.show(ctx, "live:$id", title, "Pukul $hhmm WIB", at, true, -1, hhmm, left + 60_000L, "")
  }
}
