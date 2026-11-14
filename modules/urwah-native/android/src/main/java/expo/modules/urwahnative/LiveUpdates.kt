package expo.modules.urwahnative

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

// "Pulau" di luar app: notifikasi Live Update Android 16 (di Samsung tampil di Now Bar & chip bilah status).
// Di Android lama tampil sebagai notifikasi berjalan biasa dengan hitung mundur.
object LiveUpdates {
  const val CHANNEL = "urwah_live_v1"

  private fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL) != null) return
    val ch = NotificationChannel(CHANNEL, "Live Update (pulau)", NotificationManager.IMPORTANCE_DEFAULT)
    ch.setSound(null, null)
    ch.enableVibration(false)
    ch.lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    nm.createNotificationChannel(ch)
  }

  fun openAppIntent(ctx: Context, path: String): PendingIntent {
    val i = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent()
    i.action = Intent.ACTION_VIEW
    i.data = Uri.parse("managerurwah://$path")
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(ctx, path.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /**
   * @param whenMs  waktu acuan (0 = tidak ada). countdown=true → hitung mundur ke waktu itu, false → hitung maju sejak waktu itu.
   * @param progress 0..100, atau -1 bila tanpa bilah progres.
   */
  fun show(ctx: Context, id: String, title: String, text: String, whenMs: Long, countdown: Boolean, progress: Int, shortText: String?, timeoutMs: Long, path: String) {
    ensureChannel(ctx)
    val b = NotificationCompat.Builder(ctx, CHANNEL)
      .setSmallIcon(R.drawable.urwah_stat)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(openAppIntent(ctx, path))
    if (whenMs > 0) {
      b.setWhen(whenMs).setShowWhen(true).setUsesChronometer(true)
      if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(countdown)
    }
    if (progress >= 0) b.setProgress(100, progress.coerceIn(0, 100), false)
    if (timeoutMs > 0) b.setTimeoutAfter(timeoutMs)
    val extras = Bundle()
    extras.putBoolean("android.requestPromotedOngoing", true) // Notification.EXTRA_REQUEST_PROMOTED_ONGOING
    if (!shortText.isNullOrEmpty()) extras.putString("android.shortCriticalText", shortText) // EXTRA_SHORT_CRITICAL_TEXT
    b.addExtras(extras)
    try {
      NotificationManagerCompat.from(ctx).notify(id.hashCode(), b.build())
    } catch (e: SecurityException) {
      // Izin notifikasi belum diberikan.
    }
  }

  fun cancel(ctx: Context, id: String) {
    NotificationManagerCompat.from(ctx).cancel(id.hashCode())
  }

  /** Android 16+: apakah pengguna mengizinkan app tampil sebagai Live Update. */
  fun canPromote(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < 36) return false
    return try {
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val m = nm.javaClass.getMethod("canPostPromotedNotifications")
      m.invoke(nm) as Boolean
    } catch (e: Exception) {
      false
    }
  }
}
