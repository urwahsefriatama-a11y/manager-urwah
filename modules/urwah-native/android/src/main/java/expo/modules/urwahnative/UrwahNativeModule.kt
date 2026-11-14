package expo.modules.urwahnative

import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Modul native Manager Urwah: alarm layar penuh, widget, Live Update, adzan & senyap,
// pengenalan suara ("Halo asisten"), peluncuran dari tombol asisten HP, dan izin Google Drive.
class UrwahNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("Context belum siap")

  private val main = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var authPromise: Promise? = null
  private val REQ_AUTH = 7402

  private fun emitSpeech(type: String, text: String = "", value: Double = 0.0) {
    sendEvent("onSpeech", mapOf("type" to type, "text" to text, "value" to value))
  }

  private fun startRecognizer(lang: String) {
    recognizer?.destroy()
    val r = SpeechRecognizer.createSpeechRecognizer(context)
    r.setRecognitionListener(object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) = emitSpeech("ready")
      override fun onBeginningOfSpeech() = emitSpeech("begin")
      override fun onRmsChanged(rmsdB: Float) = emitSpeech("level", value = rmsdB.toDouble())
      override fun onBufferReceived(buffer: ByteArray?) {}
      override fun onEndOfSpeech() = emitSpeech("end")
      override fun onError(error: Int) = emitSpeech("error", value = error.toDouble())
      override fun onResults(results: Bundle?) {
        val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        emitSpeech("final", list?.firstOrNull() ?: "")
      }
      override fun onPartialResults(partial: Bundle?) {
        val list = partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val t = list?.firstOrNull() ?: ""
        if (t.isNotEmpty()) emitSpeech("partial", t)
      }
      override fun onEvent(eventType: Int, params: Bundle?) {}
    })
    val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1600L)
    }
    recognizer = r
    r.startListening(i)
  }

  private fun deliverAuth(result: AuthorizationResult) {
    val token = result.accessToken
    if (token != null) authPromise?.resolve(token) else authPromise?.reject("NO_TOKEN", "Google tidak memberi token akses.", null)
    authPromise = null
  }

  override fun definition() = ModuleDefinition {
    Name("UrwahNative")
    Events("onSpeech", "onAssist")

    // ---------- Alarm ----------
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
    Function("cancelAlarm") { id: String -> AlarmScheduler.cancel(context, id) }
    Function("stopRinging") { id: String -> AlarmScheduler.dismissNotification(context, id) }
    Function("snooze") { id: String, minutes: Int -> AlarmScheduler.snooze(context, id, minutes) }
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
    Function("showOverLock") { on: Boolean ->
      val act = appContext.currentActivity
      if (act != null && Build.VERSION.SDK_INT >= 27) {
        act.runOnUiThread {
          act.setShowWhenLocked(on)
          act.setTurnScreenOn(on)
        }
      }
    }
    Function("setWidgetData") { json: String -> UrwahWidget.save(context, json) }

    // ---------- Live Update (pulau di luar app) ----------
    Function("liveShow") { id: String, title: String, text: String, whenMs: Double, countdown: Boolean, progress: Int, shortText: String, timeoutMs: Double, path: String ->
      LiveUpdates.show(context, id, title, text, whenMs.toLong(), countdown, progress, shortText, timeoutMs.toLong(), path)
    }
    Function("liveCancel") { id: String -> LiveUpdates.cancel(context, id) }
    Function("canPromote") { LiveUpdates.canPromote(context) }
    Function("scheduleLive") { id: String, atMs: Double, title: String, leadMin: Int ->
      PrayerScheduler.scheduleLive(context, id, atMs.toLong(), title, leadMin * 60_000L)
    }
    Function("cancelLive") { id: String -> PrayerScheduler.cancelLive(context, id) }
    Function("openNotificationSettings") {
      val i = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(i)
    }

    // ---------- Shalat: adzan & senyap ----------
    Function("schedulePrayer") { id: String, atMs: Double, title: String, fileUri: String, silentMin: Int ->
      PrayerScheduler.schedule(context, id, atMs.toLong(), title, fileUri, silentMin)
    }
    Function("cancelPrayer") { id: String -> PrayerScheduler.cancel(context, id) }
    Function("playAdzan") { title: String, fileUri: String -> PrayerScheduler.startAdzan(context, title, fileUri) }
    Function("stopAdzan") { PrayerScheduler.stopAdzan(context) }
    Function("hasDndAccess") { PrayerScheduler.hasDnd(context) }
    Function("openDndSettings") {
      val i = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(i)
    }

    // ---------- Suara ----------
    Function("speechAvailable") { SpeechRecognizer.isRecognitionAvailable(context) }
    Function("startListening") { lang: String -> main.post { try { startRecognizer(lang) } catch (e: Exception) { emitSpeech("error", value = -1.0) } } }
    Function("stopListening") { main.post { recognizer?.stopListening() } }
    Function("cancelListening") { main.post { recognizer?.destroy(); recognizer = null } }

    // ---------- Tombol asisten HP (tekan lama tombol samping) ----------
    Function("launchedByAssist") {
      val act = appContext.currentActivity
      val hit = act?.intent?.action == Intent.ACTION_ASSIST
      if (hit) act?.intent?.action = Intent.ACTION_MAIN // agar tidak terpicu dua kali
      hit
    }
    Function("openAssistantSettings") {
      val i = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(i)
    }
    OnNewIntent { intent ->
      if (intent.action == Intent.ACTION_ASSIST) sendEvent("onAssist", mapOf("at" to System.currentTimeMillis()))
    }

    // ---------- Google Drive (izin akses via Google Identity Services) ----------
    AsyncFunction("googleAuthorize") { scopes: List<String>, promise: Promise ->
      val act = appContext.currentActivity
      if (act == null) {
        promise.reject("NO_ACTIVITY", "App belum siap.", null)
        return@AsyncFunction
      }
      val req = AuthorizationRequest.builder().setRequestedScopes(scopes.map { Scope(it) }).build()
      Identity.getAuthorizationClient(act).authorize(req)
        .addOnSuccessListener { res ->
          if (res.hasResolution()) {
            val pi = res.pendingIntent
            if (pi == null) {
              promise.reject("NO_INTENT", "Google tidak menampilkan layar izin.", null)
              return@addOnSuccessListener
            }
            authPromise = promise
            try {
              act.startIntentSenderForResult(pi.intentSender, REQ_AUTH, null, 0, 0, 0)
            } catch (e: Exception) {
              authPromise = null
              promise.reject("INTENT_FAILED", e.message ?: "Gagal membuka layar izin Google.", e)
            }
          } else {
            val token = res.accessToken
            if (token != null) promise.resolve(token) else promise.reject("NO_TOKEN", "Google tidak memberi token akses.", null)
          }
        }
        .addOnFailureListener { e -> promise.reject("AUTH_FAILED", e.message ?: "Izin Google gagal.", e) }
    }
    OnActivityResult { activity: Activity, payload ->
      if (payload.requestCode != REQ_AUTH) return@OnActivityResult
      val p = authPromise ?: return@OnActivityResult
      if (payload.resultCode != Activity.RESULT_OK) {
        p.reject("CANCELLED", "Izin Google dibatalkan.", null)
        authPromise = null
        return@OnActivityResult
      }
      try {
        deliverAuth(Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(payload.data))
      } catch (e: Exception) {
        p.reject("AUTH_FAILED", e.message ?: "Izin Google gagal.", e)
        authPromise = null
      }
    }
  }
}
