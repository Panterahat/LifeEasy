package com.example.lifeeasy.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.example.lifeeasy.MainActivity
import com.example.lifeeasy.R

class TodayChecklistWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_TOGGLE_TASK = "com.example.lifeeasy.widgets.ACTION_TOGGLE_TASK"
        const val EXTRA_TASK_ID = "extra_task_id"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (intent.action == ACTION_TOGGLE_TASK) {
            val taskId = intent.getStringExtra(EXTRA_TASK_ID)
            if (!taskId.isNullOrEmpty()) {
                WidgetDataStore.toggleTask(context, taskId)
            }
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_today_checklist)

        // Setup ListView adapter Intent with appWidgetId
        val serviceIntent = Intent(context, ChecklistRemoteViewsService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        serviceIntent.data = Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME))
        views.setRemoteAdapter(R.id.checklist_list, serviceIntent)
        views.setEmptyView(R.id.checklist_list, R.id.checklist_empty_view)

        // Header click -> Open app to tasks screen
        val headerIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_screen", "tasks")
        }
        val headerPendingIntent = PendingIntent.getActivity(
            context,
            101,
            headerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_checklist_header, headerPendingIntent)

        // Settings button -> Open ChecklistWidgetConfigActivity
        val configIntent = Intent(context, ChecklistWidgetConfigActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        val configPendingIntent = PendingIntent.getActivity(
            context,
            103,
            configIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_checklist_widget_settings, configPendingIntent)

        // Template for item checkbox toggle
        val toggleIntent = Intent(context, TodayChecklistWidgetProvider::class.java).apply {
            action = ACTION_TOGGLE_TASK
        }
        val togglePendingIntent = PendingIntent.getBroadcast(
            context,
            102,
            toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.checklist_list, togglePendingIntent)

        // Update task count summary
        val tasks = WidgetDataStore.getTodayTasks(context, appWidgetId)
        val totalCount = tasks.size
        views.setTextViewText(R.id.checklist_summary, "$totalCount tasks")

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
