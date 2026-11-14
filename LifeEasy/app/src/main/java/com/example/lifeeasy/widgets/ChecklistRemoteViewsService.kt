package com.example.lifeeasy.widgets

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.lifeeasy.R

class ChecklistRemoteViewsService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        val appWidgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        )
        return ChecklistRemoteViewsFactory(applicationContext, appWidgetId)
    }
}

class ChecklistRemoteViewsFactory(
    private val context: Context,
    private val appWidgetId: Int
) : RemoteViewsService.RemoteViewsFactory {

    private var items: List<TaskItem> = emptyList()

    override fun onCreate() {}

    override fun onDataSetChanged() {
        items = WidgetDataStore.getTodayTasks(context, appWidgetId)
    }

    override fun onDestroy() {
        items = emptyList()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews? {
        if (position !in items.indices) return null
        val item = items[position]

        val views = RemoteViews(context.packageName, R.layout.widget_checklist_item)
        views.setTextViewText(R.id.task_title, item.title)

        if (item.completed) {
            views.setImageViewResource(R.id.btn_task_checkbox, android.R.drawable.checkbox_on_background)
        } else {
            views.setImageViewResource(R.id.btn_task_checkbox, android.R.drawable.checkbox_off_background)
        }

        if (!item.checklistProgress.isNullOrEmpty()) {
            views.setTextViewText(R.id.task_progress, item.checklistProgress)
            views.setViewVisibility(R.id.task_progress, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.task_progress, View.GONE)
        }

        // Fill-in Intent for checkbox click
        val fillInIntent = Intent().apply {
            putExtra(TodayChecklistWidgetProvider.EXTRA_TASK_ID, item.id)
        }
        views.setOnClickFillInIntent(R.id.btn_task_checkbox, fillInIntent)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long {
        return if (position in items.indices) items[position].id.hashCode().toLong() else position.toLong()
    }

    override fun hasStableIds(): Boolean = true
}
