package com.example.lifeeasy.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.example.lifeeasy.MainActivity
import com.example.lifeeasy.R

class AcademicCountdownWidgetProvider : AppWidgetProvider() {

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

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_academic_countdown)

        // Header click -> Open app to academic / tasks screen
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_screen", "academic")
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            501,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_academic_container, pendingIntent)

        val item = WidgetDataStore.getAcademicCountdown(context)

        if (item != null) {
            views.setViewVisibility(R.id.academic_content_layout, View.VISIBLE)
            views.setViewVisibility(R.id.academic_empty_view, View.GONE)

            views.setTextViewText(R.id.academic_title, item.title)
            views.setTextViewText(R.id.academic_countdown_badge, item.countdownText)

            val subjStr = if (!item.subject.isNullOrEmpty()) "📖 ${item.subject}" else "📖 Academic Task"
            views.setTextViewText(R.id.academic_subject, subjStr)

            val dueStr = if (!item.due.isNullOrEmpty()) "📅 Due: ${item.due}" else ""
            views.setTextViewText(R.id.academic_due, dueStr)
        } else {
            views.setViewVisibility(R.id.academic_content_layout, View.GONE)
            views.setViewVisibility(R.id.academic_empty_view, View.VISIBLE)
            views.setTextViewText(R.id.academic_countdown_badge, "No Exams")
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
