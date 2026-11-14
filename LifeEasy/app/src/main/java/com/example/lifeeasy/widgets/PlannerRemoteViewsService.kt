package com.example.lifeeasy.widgets

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.lifeeasy.R

class PlannerRemoteViewsService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return PlannerRemoteViewsFactory(applicationContext)
    }
}

class PlannerRemoteViewsFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {

    private var items: List<PlanItem> = emptyList()

    override fun onCreate() {}

    override fun onDataSetChanged() {
        items = WidgetDataStore.getTodayPlans(context)
    }

    override fun onDestroy() {
        items = emptyList()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews? {
        if (position !in items.indices) return null
        val item = items[position]

        val views = RemoteViews(context.packageName, R.layout.widget_planner_item)
        views.setTextViewText(R.id.planner_item_title, item.title)

        val timeStr = if (!item.startTime.isNullOrEmpty() && !item.endTime.isNullOrEmpty()) {
            "⏰ ${item.startTime} - ${item.endTime}"
        } else if (!item.startTime.isNullOrEmpty()) {
            "⏰ ${item.startTime}"
        } else {
            "⏰ All Day"
        }
        views.setTextViewText(R.id.planner_item_time, timeStr)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long {
        return if (position in items.indices) items[position].id.hashCode().toLong() else position.toLong()
    }

    override fun hasStableIds(): Boolean = true
}
