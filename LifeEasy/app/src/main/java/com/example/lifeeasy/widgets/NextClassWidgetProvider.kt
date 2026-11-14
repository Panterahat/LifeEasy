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

class NextClassWidgetProvider : AppWidgetProvider() {

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
        val views = RemoteViews(context.packageName, R.layout.widget_next_class)

        // Header click -> Open app to attendance / routine screen
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_screen", "attendance")
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            301,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_next_class_container, pendingIntent)

        val nextClass = WidgetDataStore.getNextClass(context)

        if (nextClass != null) {
            views.setViewVisibility(R.id.class_content_layout, View.VISIBLE)
            views.setViewVisibility(R.id.class_empty_view, View.GONE)

            views.setTextViewText(R.id.class_subject, nextClass.subject)
            views.setTextViewText(R.id.class_status_badge, nextClass.statusText)

            val timeStr = if (!nextClass.startTime.isNullOrEmpty() && !nextClass.endTime.isNullOrEmpty()) {
                "⏰ ${nextClass.startTime} - ${nextClass.endTime}"
            } else if (!nextClass.startTime.isNullOrEmpty()) {
                "⏰ ${nextClass.startTime}"
            } else {
                "⏰ Class Routine"
            }
            views.setTextViewText(R.id.class_time, timeStr)

            if (!nextClass.room.isNullOrEmpty()) {
                views.setTextViewText(R.id.class_room, "📍 Room ${nextClass.room}")
                views.setViewVisibility(R.id.class_room, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.class_room, View.GONE)
            }
        } else {
            views.setViewVisibility(R.id.class_content_layout, View.GONE)
            views.setViewVisibility(R.id.class_empty_view, View.VISIBLE)
            views.setTextViewText(R.id.class_status_badge, "No Class")
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
