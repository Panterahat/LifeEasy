package com.example.lifeeasy.widgets

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.example.lifeeasy.R

class AcademicRemoteViewsService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        val appWidgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        )
        return AcademicRemoteViewsFactory(applicationContext, appWidgetId)
    }
}

class AcademicRemoteViewsFactory(
    private val context: Context,
    private val appWidgetId: Int
) : RemoteViewsService.RemoteViewsFactory {

    private var examList: List<AcademicItem> = emptyList()

    override fun onCreate() {}

    override fun onDataSetChanged() {
        examList = WidgetDataStore.getUpcomingExams(context)
    }

    override fun onDestroy() {
        examList = emptyList()
    }

    override fun getCount(): Int = examList.size

    override fun getViewAt(position: Int): RemoteViews? {
        if (position !in examList.indices) return null
        val item = examList[position]

        val views = RemoteViews(context.packageName, R.layout.widget_academic_item)
        views.setTextViewText(R.id.academic_item_title, item.title)
        views.setTextViewText(R.id.academic_item_badge, item.countdownText)

        val subjStr = if (!item.subject.isNullOrEmpty()) "📖 ${item.subject}" else "📖 Academic Task"
        views.setTextViewText(R.id.academic_item_subject, subjStr)

        val dueStr = if (!item.due.isNullOrEmpty()) "📅 Due: ${item.due}" else ""
        views.setTextViewText(R.id.academic_item_due, dueStr)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long {
        return if (position in examList.indices) examList[position].id.hashCode().toLong() else position.toLong()
    }

    override fun hasStableIds(): Boolean = true
}
