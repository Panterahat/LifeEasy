package com.example.lifeeasy.widgets

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.lifeeasy.R

class ClassRoutineRemoteViewsService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        val appWidgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        )
        return ClassRoutineRemoteViewsFactory(applicationContext, appWidgetId)
    }
}

class ClassRoutineRemoteViewsFactory(
    private val context: Context,
    private val appWidgetId: Int
) : RemoteViewsService.RemoteViewsFactory {

    private var classesList: List<ClassRoutineItem> = emptyList()

    override fun onCreate() {}

    override fun onDataSetChanged() {
        classesList = WidgetDataStore.getTodayClasses(context)
    }

    override fun onDestroy() {
        classesList = emptyList()
    }

    override fun getCount(): Int = classesList.size

    override fun getViewAt(position: Int): RemoteViews? {
        if (position !in classesList.indices) return null
        val item = classesList[position]

        val views = RemoteViews(context.packageName, R.layout.widget_class_item)
        views.setTextViewText(R.id.class_item_subject, item.subject)
        views.setTextViewText(R.id.class_item_status, item.statusText)

        val timeStr = if (!item.startTime.isNullOrEmpty() && !item.endTime.isNullOrEmpty()) {
            "⏰ ${item.startTime} - ${item.endTime}"
        } else {
            "⏰ ${item.startTime.orEmpty()}"
        }
        views.setTextViewText(R.id.class_item_time, timeStr)

        if (!item.room.isNullOrEmpty()) {
            views.setTextViewText(R.id.class_item_room, "📍 Room ${item.room}")
            views.setViewVisibility(R.id.class_item_room, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.class_item_room, View.GONE)
        }

        if (item.statusText == "Finished") {
            views.setFloat(R.id.class_item_container, "setAlpha", 0.5f)
        } else {
            views.setFloat(R.id.class_item_container, "setAlpha", 1.0f)
        }

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long {
        return if (position in classesList.indices) classesList[position].id.hashCode().toLong() else position.toLong()
    }

    override fun hasStableIds(): Boolean = true
}
