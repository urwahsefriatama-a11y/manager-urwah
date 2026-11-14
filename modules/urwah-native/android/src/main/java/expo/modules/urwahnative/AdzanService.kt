package expo.modules.urwahnative

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

// Memutar adzan dari file yang dipilih pemilik, sebagai layanan latar depan (bisa dihentikan dari notifikasi).
class AdzanService : Service() {
  private var player: MediaPlayer? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      finish()
      return START_NOT_STICKY
    }
    val title = intent?.getStringExtra("title") ?: "Waktu shalat"
    val file = intent?.getStringExtra("file") ?: ""
    startAsForeground(title)
    play(file)
    return START_NOT_STICKY
  }

  private fun startAsForeground(title: String) {
    if (Build.VERSION.SDK_INT >= 26) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL) == null) {
        val ch = NotificationChannel(CHANNEL, "Adzan", NotificationManager.IMPORTANCE_HIGH)
        ch.setSound(null, null)
        nm.createNotificationChannel(ch)
      }
    }
    val stop = PendingIntent.getService(this, 4401, Intent(this, AdzanService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val n = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(R.drawable.urwah_stat)
      .setContentTitle(title)
      .setContentText("Adzan sedang berkumandang")
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setContentIntent(LiveUpdates.openAppIntent(this, "shalat"))
      .addAction(0, "Hentikan", stop)
      .build()
    if (Build.VERSION.SDK_INT >= 29) startForeground(4400, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    else startForeground(4400, n)
  }

  private fun play(file: String) {
    try {
      player?.release()
      val p = MediaPlayer()
      p.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
      p.setDataSource(this, Uri.parse(file))
      p.setOnCompletionListener { finish() }
      p.setOnErrorListener { _, _, _ -> finish(); true }
      p.setOnPreparedListener { it.start() }
      p.prepareAsync()
      player = p
    } catch (e: Exception) {
      finish()
    }
  }

  private fun finish() {
    try { player?.stop() } catch (e: Exception) {}
    player?.release()
    player = null
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
    stopSelf()
  }

  override fun onDestroy() {
    player?.release()
    player = null
    super.onDestroy()
  }

  companion object {
    const val CHANNEL = "urwah_adzan_v1"
    const val ACTION_STOP = "expo.modules.urwahnative.ADZAN_STOP"
  }
}
