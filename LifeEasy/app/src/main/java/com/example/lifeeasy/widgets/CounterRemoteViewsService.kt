package com.example.lifeeasy.widgets

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.lifeeasy.R
import java.util.Locale

class CounterRemoteViewsService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        val appWidgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        )
        return CounterRemoteViewsFactory(applicationContext, appWidgetId)
    }
}

class CounterRemoteViewsFactory(
    private val context: Context,
    private val appWidgetId: Int
) : RemoteViewsService.RemoteViewsFactory {

    private var items: List<CounterItem> = emptyList()

    override fun onCreate() {}

    override fun onDataSetChanged() {
        items = WidgetDataStore.getCounters(context, appWidgetId)
    }

    override fun onDestroy() {
        items = emptyList()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews? {
        if (position !in items.indices) return null
        val item = items[position]

        val views = RemoteViews(context.packageName, R.layout.widget_counter_item)
        views.setTextViewText(R.id.counter_name, item.name)

        val valStr = if (item.value % 1.0 == 0.0) item.value.toInt().toString() else String.format(Locale.getDefault(), "%.1f", item.value)
        val valueText = if (item.target != null && item.target > 0) {
            val targetStr = if (item.target % 1.0 == 0.0) item.target.toInt().toString() else String.format(Locale.getDefault(), "%.1f", item.target)
            "$valStr / $targetStr"
        } else {
            valStr
        }
        views.setTextViewText(R.id.counter_value_text, valueText)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long {
        return if (position in items.indices) items[position].id.hashCode().toLong() else position.toLong()
    }

    override fun hasStableIds(): Boolean = true
}
