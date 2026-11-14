package com.example.lifeeasy.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.example.lifeeasy.MainActivity
import com.example.lifeeasy.R
import java.util.Locale

class DailyCountersWidgetProvider : AppWidgetProvider() {

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
        val views = RemoteViews(context.packageName, R.layout.widget_daily_counters)

        val counters = WidgetDataStore.getCounters(context, appWidgetId)

        if (counters.size == 1) {
            // Single counter view ("Smells like teen spirit" style big card with zero headers/borders)
            views.setViewVisibility(R.id.header_row_1, View.GONE)
            views.setViewVisibility(R.id.counters_summary, View.GONE)
            views.setViewVisibility(R.id.counters_list, View.GONE)
            views.setViewVisibility(R.id.counters_empty_view, View.GONE)
            views.setViewVisibility(R.id.single_counter_container, View.VISIBLE)

            val counter = counters[0]
            views.setTextViewText(R.id.single_counter_name, counter.name)

            val valStr = if (counter.value % 1.0 == 0.0) counter.value.toInt().toString() else String.format(Locale.getDefault(), "%.1f", counter.value)
            views.setTextViewText(R.id.single_counter_value, valStr)

            val updatedStr = if (!counter.lastUpdated.isNullOrEmpty()) {
                "Updated recently"
            } else {
                "Active"
            }
            views.setTextViewText(R.id.single_counter_updated, updatedStr)

        } else {
            views.setViewVisibility(R.id.header_row_1, View.VISIBLE)
            views.setViewVisibility(R.id.counters_summary, View.VISIBLE)
            views.setViewVisibility(R.id.single_counter_container, View.GONE)

            if (counters.isEmpty()) {
                views.setViewVisibility(R.id.counters_list, View.GONE)
                views.setViewVisibility(R.id.counters_empty_view, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.counters_empty_view, View.GONE)
                views.setViewVisibility(R.id.counters_list, View.VISIBLE)

                val serviceIntent = Intent(context, CounterRemoteViewsService::class.java).apply {
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                }
                serviceIntent.data = Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME))
                views.setRemoteAdapter(R.id.counters_list, serviceIntent)
            }
        }

        // Header click -> Open app to counter screen
        val headerIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_screen", "counter")
        }
        val headerPendingIntent = PendingIntent.getActivity(
            context,
            201,
            headerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_counters_header, headerPendingIntent)

        // Settings button -> Open CounterWidgetConfigActivity
        val configIntent = Intent(context, CounterWidgetConfigActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        val configPendingIntent = PendingIntent.getActivity(
            context,
            203,
            configIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_counter_widget_settings, configPendingIntent)

        views.setTextViewText(R.id.counters_summary, "${counters.size} counters")

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
