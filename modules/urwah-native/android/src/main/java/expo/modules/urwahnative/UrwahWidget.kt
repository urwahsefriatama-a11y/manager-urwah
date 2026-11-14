package expo.modules.urwahnative

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject

// Widget layar utama: pengingat berikutnya + shalat berikutnya + progres tugas.
class UrwahWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, render(context))
  }

  companion object {
    private const val PREFS = "urwah_widget"

    fun save(ctx: Context, json: String) {
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply()
      refresh(ctx)
    }

    fun refresh(ctx: Context) {
      val manager = AppWidgetManager.getInstance(ctx)
      val ids = manager.getAppWidgetIds(ComponentName(ctx, UrwahWidget::class.java))
      for (id in ids) manager.updateAppWidget(id, render(ctx))
    }

    private fun render(ctx: Context): RemoteViews {
      val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", null)
      val d = try { if (raw != null) JSONObject(raw) else JSONObject() } catch (e: Exception) { JSONObject() }
      val v = RemoteViews(ctx.packageName, R.layout.urwah_widget)
      v.setTextViewText(R.id.w_greet, d.optString("greet", "Manager Urwah"))
      v.setTextViewText(R.id.w_next_title, d.optString("next_title", "Tidak ada pengingat"))
      v.setTextViewText(R.id.w_next_time, d.optString("next_time", "--:--"))
      v.setTextViewText(R.id.w_prayer, d.optString("prayer", ""))
      v.setTextViewText(R.id.w_tasks, d.optString("tasks", ""))
      val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
      if (launch != null) {
        val pi = PendingIntent.getActivity(ctx, 7001, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        v.setOnClickPendingIntent(R.id.w_root, pi)
      }
      return v
    }
  }
}
