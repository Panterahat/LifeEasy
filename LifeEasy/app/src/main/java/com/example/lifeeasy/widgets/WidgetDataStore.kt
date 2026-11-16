package com.example.lifeeasy.widgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.example.lifeeasy.R
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

data class TaskItem(
    val id: String,
    val title: String,
    val completed: Boolean,
    val due: String?,
    val checklistProgress: String? = null
)

data class CounterItem(
    val id: String,
    val name: String,
    val value: Double,
    val target: Double?,
    val step: Double,
    val lastUpdated: String? = null
)

data class ClassRoutineItem(
    val id: String,
    val subject: String,
    val room: String?,
    val startTime: String?,
    val endTime: String?,
    val dayOfWeek: Int,
    val statusText: String = ""
)

data class PlanItem(
    val id: String,
    val title: String,
    val date: String?,
    val startTime: String?,
    val endTime: String?,
    val category: String?
)

data class AcademicItem(
    val id: String,
    val title: String,
    val due: String?,
    val subject: String?,
    val type: String?,
    val countdownText: String = ""
)

object WidgetDataStore {

    private const val PREF_NAME = "lifeeasy_widget_prefs"
    private const val KEY_TASKS_JSON = "tasks_json"
    private const val KEY_COUNTERS_JSON = "counters_json"
    private const val KEY_ROUTINES_JSON = "routines_json"
    private const val KEY_PLANS_JSON = "plans_json"
    private const val KEY_ACADEMIC_JSON = "academic_json"
    private const val KEY_PENDING_TASKS = "pending_tasks_toggles"
    private const val KEY_PENDING_COUNTERS = "pending_counter_adjustments"
    private const val PREF_COUNTER_WIDGET_IDS = "counter_widget_selected_ids_"
    private const val PREF_CHECKLIST_TAG = "checklist_widget_tag_"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    fun updateData(
        context: Context,
        tasksJson: String?,
        countersJson: String?,
        routinesJson: String?,
        plansJson: String?,
        academicJson: String?
    ) {
        val editor = getPrefs(context).edit()
        if (tasksJson != null) editor.putString(KEY_TASKS_JSON, tasksJson)
        if (countersJson != null) editor.putString(KEY_COUNTERS_JSON, countersJson)
        if (routinesJson != null) editor.putString(KEY_ROUTINES_JSON, routinesJson)
        if (plansJson != null) editor.putString(KEY_PLANS_JSON, plansJson)
        if (academicJson != null) editor.putString(KEY_ACADEMIC_JSON, academicJson)
        editor.apply()

        notifyAllWidgets(context)
    }

    fun saveSelectedCounters(context: Context, appWidgetId: Int, selectedIds: Set<String>) {
        getPrefs(context).edit().putStringSet(PREF_COUNTER_WIDGET_IDS + appWidgetId, selectedIds).apply()
        notifyAllWidgets(context)
    }

    fun getSelectedCounterIds(context: Context, appWidgetId: Int): Set<String>? {
        return getPrefs(context).getStringSet(PREF_COUNTER_WIDGET_IDS + appWidgetId, null)
    }

    fun saveSelectedChecklistTag(context: Context, appWidgetId: Int, tag: String?) {
        val editor = getPrefs(context).edit()
        if (tag == null) {
            editor.remove(PREF_CHECKLIST_TAG + appWidgetId)
        } else {
            editor.putString(PREF_CHECKLIST_TAG + appWidgetId, tag)
        }
        editor.apply()
        notifyAllWidgets(context)
    }

    fun getSelectedChecklistTag(context: Context, appWidgetId: Int): String? {
        return getPrefs(context).getString(PREF_CHECKLIST_TAG + appWidgetId, null)
    }

    fun getAvailableTaskCategories(context: Context): List<String> {
        val tasksJson = getPrefs(context).getString(KEY_TASKS_JSON, "[]") ?: "[]"
        val categories = mutableSetOf<String>()
        categories.add("All")
        try {
            val jsonArray = JSONArray(tasksJson)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val cat = obj.optString("category", obj.optString("tag", ""))
                if (cat.isNotBlank()) {
                    categories.add(cat.trim())
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return categories.toList()
    }

    fun getTodayTasks(context: Context, appWidgetId: Int = AppWidgetManager.INVALID_APPWIDGET_ID): List<TaskItem> {
        val tasksJson = getPrefs(context).getString(KEY_TASKS_JSON, "[]") ?: "[]"
        val result = mutableListOf<TaskItem>()
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val selectedTag = if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            getSelectedChecklistTag(context, appWidgetId)
        } else {
            null
        }

        try {
            val jsonArray = JSONArray(tasksJson)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val id = obj.optString("id", "")
                val title = obj.optString("title", "Task")
                val completed = obj.optBoolean("completed", false)
                val due = obj.optString("due", "")
                val category = obj.optString("category", obj.optString("tag", ""))

                val isTodayOrOverdueOrNoDate = due.isEmpty() || due <= todayStr
                val matchesTag = selectedTag == null || category.equals(selectedTag, ignoreCase = true)

                if (!completed && isTodayOrOverdueOrNoDate && matchesTag) {
                    var progressStr: String? = null
                    if (obj.has("checklist") && !obj.isNull("checklist")) {
                        val checklistArr = obj.optJSONArray("checklist")
                        if (checklistArr != null && checklistArr.length() > 0) {
                            var done = 0
                            for (j in 0 until checklistArr.length()) {
                                val item = checklistArr.getJSONObject(j)
                                if (item.optBoolean("completed", false)) done++
                            }
                            progressStr = "$done/${checklistArr.length()}"
                        }
                    }

                    result.add(TaskItem(id, title, completed, due, progressStr))
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return result
    }

    fun toggleTask(context: Context, taskId: String) {
        val tasksJson = getPrefs(context).getString(KEY_TASKS_JSON, "[]") ?: "[]"
        try {
            val jsonArray = JSONArray(tasksJson)
            var targetFound = false
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                if (obj.optString("id") == taskId) {
                    val current = obj.optBoolean("completed", false)
                    obj.put("completed", !current)
                    targetFound = true
                    break
                }
            }
            if (targetFound) {
                getPrefs(context).edit().putString(KEY_TASKS_JSON, jsonArray.toString()).apply()

                val pendingJson = getPrefs(context).getString(KEY_PENDING_TASKS, "[]") ?: "[]"
                val pendingArr = JSONArray(pendingJson)
                pendingArr.put(taskId)
                getPrefs(context).edit().putString(KEY_PENDING_TASKS, pendingArr.toString()).apply()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        notifyAllWidgets(context)
    }

    fun getCounters(context: Context, appWidgetId: Int = AppWidgetManager.INVALID_APPWIDGET_ID): List<CounterItem> {
        val countersJson = getPrefs(context).getString(KEY_COUNTERS_JSON, "[]") ?: "[]"
        val result = mutableListOf<CounterItem>()
        val selectedIds = if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            getSelectedCounterIds(context, appWidgetId)
        } else {
            null
        }

        try {
            val jsonArray = JSONArray(countersJson)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val id = obj.optString("id", "")
                val name = obj.optString("name", "Counter")
                val value = obj.optDouble("value", 0.0)
                val target = if (obj.has("target") && !obj.isNull("target")) obj.optDouble("target") else null
                val step = obj.optDouble("step", 1.0)
                val lastUpdated = obj.optString("lastUpdated", obj.optString("last_updated", ""))

                if (selectedIds == null || selectedIds.contains(id)) {
                    result.add(CounterItem(id, name, value, target, if (step <= 0) 1.0 else step, lastUpdated))
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return result
    }

    fun adjustCounter(context: Context, counterId: String, dir: Int) {
        val countersJson = getPrefs(context).getString(KEY_COUNTERS_JSON, "[]") ?: "[]"
        try {
            val jsonArray = JSONArray(countersJson)
            var deltaApplied = 0.0
            var targetFound = false
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                if (obj.optString("id") == counterId) {
                    val step = obj.optDouble("step", 1.0)
                    val effectiveStep = if (step <= 0) 1.0 else step
                    val before = obj.optDouble("value", 0.0)
                    deltaApplied = dir * effectiveStep
                    val after = before + deltaApplied
                    obj.put("value", after)

                    val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())
                    obj.put("lastUpdated", nowIso)

                    val historyArr = obj.optJSONArray("history") ?: JSONArray()
                    val histObj = JSONObject().apply {
                        put("type", if (dir > 0) "increment" else "decrement")
                        put("before", before)
                        put("change", deltaApplied)
                        put("after", after)
                        put("timestamp", nowIso)
                    }
                    historyArr.put(histObj)
                    obj.put("history", historyArr)
                    targetFound = true
                    break
                }
            }
            if (targetFound) {
                getPrefs(context).edit().putString(KEY_COUNTERS_JSON, jsonArray.toString()).apply()

                val pendingJson = getPrefs(context).getString(KEY_PENDING_COUNTERS, "[]") ?: "[]"
                val pendingArr = JSONArray(pendingJson)
                val adjObj = JSONObject().apply {
                    put("id", counterId)
                    put("delta", deltaApplied)
                }
                pendingArr.put(adjObj)
                getPrefs(context).edit().putString(KEY_PENDING_COUNTERS, pendingArr.toString()).apply()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        notifyAllWidgets(context)
    }

    fun getTodayPlans(context: Context): List<PlanItem> {
        val plansJson = getPrefs(context).getString(KEY_PLANS_JSON, "[]") ?: "[]"
        val result = mutableListOf<PlanItem>()
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

        try {
            val jsonArray = JSONArray(plansJson)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val id = obj.optString("id", "")
                val title = obj.optString("title", "Event")
                val date = obj.optString("date", "")
                val startTime = obj.optString("startTime", "")
                val endTime = obj.optString("endTime", "")
                val category = obj.optString("category", "")

                if (date == todayStr || date.isEmpty()) {
                    result.add(PlanItem(id, title, date, startTime, endTime, category))
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return result.sortedBy { it.startTime.orEmpty() }
    }

    fun getAcademicCountdown(context: Context): AcademicItem? {
        val list = getUpcomingExams(context)
        return list.firstOrNull()
    }

    fun getUpcomingExams(context: Context): List<AcademicItem> {
        val academicJson = getPrefs(context).getString(KEY_ACADEMIC_JSON, "[]") ?: "[]"
        val todayCalendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val todayDate = todayCalendar.time
        val nowMillis = System.currentTimeMillis()

        val dateFormats = listOf(
            SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()),
            SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        )

        val items = mutableListOf<Pair<Long, AcademicItem>>()

        try {
            val jsonArray = JSONArray(academicJson)

            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val id = obj.optString("id", "")

                val subject = obj.optString("subject", obj.optString("courseName", obj.optString("courseCode", "")))
                    .takeIf { it.isNotBlank() && it != "null" } ?: ""

                val type = obj.optString("type", "Exam")
                    .takeIf { it.isNotBlank() && it != "null" } ?: "Exam"

                var rawTitle = obj.optString("title", "")
                if (rawTitle.isBlank() || rawTitle == "null") {
                    rawTitle = if (subject.isNotBlank()) "$type: $subject" else type
                }

                val dateStr = listOf(
                    obj.optString("date", ""),
                    obj.optString("due", ""),
                    obj.optString("due_date", "")
                ).firstOrNull { it.isNotBlank() && it != "null" } ?: ""

                val timeStr = obj.optString("time", "09:00")
                val roomStr = obj.optString("room", "")

                if (dateStr.isNotEmpty()) {
                    var parsedDueDate: Date? = null
                    for (fmt in dateFormats) {
                        try {
                            parsedDueDate = fmt.parse(dateStr)
                            if (parsedDueDate != null) break
                        } catch (_: Exception) {}
                    }

                    if (parsedDueDate != null) {
                        val targetCal = Calendar.getInstance().apply {
                            time = parsedDueDate
                            val (h, m) = parseTimeToHoursAndMinutes(timeStr)
                            set(Calendar.HOUR_OF_DAY, h)
                            set(Calendar.MINUTE, m)
                            set(Calendar.SECOND, 0)
                            set(Calendar.MILLISECOND, 0)
                        }

                        val diffMillis = targetCal.timeInMillis - nowMillis
                        val diffDays = TimeUnit.MILLISECONDS.toDays(targetCal.timeInMillis - todayDate.time)

                        if (diffDays >= 0) {
                            val countdownStr = when {
                                diffDays == 0L -> {
                                    if (diffMillis > 0) {
                                        val diffMin = TimeUnit.MILLISECONDS.toMinutes(diffMillis)
                                        if (diffMin < 60) "Starts in ${diffMin}m ⚡"
                                        else "Starts in ${diffMin / 60}h ${diffMin % 60}m ⚡"
                                    } else {
                                        "Today ⚡"
                                    }
                                }
                                diffDays == 1L -> "Tomorrow ⏰"
                                diffDays in 2..30 -> "In $diffDays days ⏳"
                                else -> "In ${diffDays / 30}mo ⏳"
                            }
                            val displaySubj = if (roomStr.isNotBlank()) "$subject (Room $roomStr)" else subject
                            items.add(targetCal.timeInMillis to AcademicItem(id, rawTitle, dateStr, displaySubj, type, countdownStr))
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return items.sortedBy { it.first }.map { it.second }
    }

    private fun parseTimeToHoursAndMinutes(timeStr: String?): Pair<Int, Int> {
        if (timeStr.isNullOrBlank()) return Pair(9, 0)
        return try {
            val clean = timeStr.trim().uppercase()
            val isPM = clean.contains("PM")
            val isAM = clean.contains("AM")
            val digits = clean.replace("AM", "").replace("PM", "").trim()
            val parts = digits.split(":")
            var hour = parts[0].toInt()
            val minute = if (parts.size > 1) parts[1].toInt() else 0

            if (isPM && hour < 12) hour += 12
            if (isAM && hour == 12) hour = 0

            Pair(hour, minute)
        } catch (e: Exception) {
            Pair(9, 0)
        }
    }

    fun getTodayClasses(context: Context): List<ClassRoutineItem> {
        val routinesJson = getPrefs(context).getString(KEY_ROUTINES_JSON, "[]") ?: "[]"
        val calendar = Calendar.getInstance()
        val currentHour = calendar.get(Calendar.HOUR_OF_DAY)
        val isAfter5PM = currentHour >= 17

        val targetCalendar = Calendar.getInstance()
        if (isAfter5PM) {
            targetCalendar.add(Calendar.DAY_OF_YEAR, 1)
        }
        val targetDayOfWeek = targetCalendar.get(Calendar.DAY_OF_WEEK) - 1
        val currentMinutes = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)

        val routines = mutableListOf<ClassRoutineItem>()
        try {
            val jsonArray = JSONArray(routinesJson)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val id = obj.optString("id", "")
                val subject = obj.optString("subject", "Class Routine")
                val room = obj.optString("room", "")
                val startTime = obj.optString("startTime", obj.optString("time", ""))
                val endTime = obj.optString("endTime", "")
                val dayStr = obj.optString("dayOfWeek", "")
                val dayOfWeek = dayStr.toIntOrNull() ?: obj.optInt("dayOfWeek", -1)

                if (dayOfWeek == targetDayOfWeek) {
                    val startMin = parseTimeToMinutes(startTime)
                    val endMin = parseTimeToMinutes(endTime)
                    val statusText = if (!isAfter5PM) {
                        if (currentMinutes in startMin..endMin) {
                            "In Progress 🟢"
                        } else if (startMin > currentMinutes) {
                            val diffMin = startMin - currentMinutes
                            if (diffMin < 60) {
                                "Starts in ${diffMin}m ⏰"
                            } else {
                                val hrs = diffMin / 60
                                val mins = diffMin % 60
                                if (mins > 0) "Starts in ${hrs}h ${mins}m ⏰" else "Starts in ${hrs}h ⏰"
                            }
                        } else {
                            "Finished"
                        }
                    } else {
                        "Tomorrow 📅"
                    }
                    routines.add(ClassRoutineItem(id, subject, room, startTime, endTime, dayOfWeek, statusText))
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return routines.sortedBy { parseTimeToMinutes(it.startTime) }
    }

    private fun parseTimeToMinutes(timeStr: String?): Int {
        if (timeStr.isNullOrBlank()) return 0
        return try {
            val clean = timeStr.trim().uppercase()
            val isPM = clean.contains("PM")
            val isAM = clean.contains("AM")
            val digits = clean.replace("AM", "").replace("PM", "").trim()
            val parts = digits.split(":")
            var hour = parts[0].toInt()
            val minute = if (parts.size > 1) parts[1].toInt() else 0

            if (isPM && hour < 12) hour += 12
            if (isAM && hour == 12) hour = 0

            hour * 60 + minute
        } catch (e: Exception) {
            0
        }
    }

    fun peekPendingActions(context: Context): JSONObject {
        val prefs = getPrefs(context)
        val pendingTasksStr = prefs.getString(KEY_PENDING_TASKS, "[]") ?: "[]"
        val pendingCountersStr = prefs.getString(KEY_PENDING_COUNTERS, "[]") ?: "[]"

        val obj = JSONObject()
        try {
            obj.put("tasks", JSONArray(pendingTasksStr))
            obj.put("counters", JSONArray(pendingCountersStr))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return obj
    }

    fun clearPendingActions(context: Context) {
        val prefs = getPrefs(context)
        prefs.edit()
            .remove(KEY_PENDING_TASKS)
            .remove(KEY_PENDING_COUNTERS)
            .apply()
    }

    fun popPendingActions(context: Context): JSONObject {
        val obj = peekPendingActions(context)
        clearPendingActions(context)
        return obj
    }

    fun notifyAllWidgets(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context)

        val providers = listOf(
            TodayChecklistWidgetProvider::class.java to R.id.checklist_list,
            DailyCountersWidgetProvider::class.java to R.id.counters_list,
            TodayPlannerWidgetProvider::class.java to R.id.planner_list,
            NextClassWidgetProvider::class.java to R.id.class_list,
            AcademicCountdownWidgetProvider::class.java to R.id.academic_list
        )

        for ((providerClass, listId) in providers) {
            val component = ComponentName(context, providerClass)
            val ids = appWidgetManager.getAppWidgetIds(component)
            if (ids.isNotEmpty()) {
                if (listId != 0) {
                    appWidgetManager.notifyAppWidgetViewDataChanged(ids, listId)
                }
                val intent = Intent(context, providerClass).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
                context.sendBroadcast(intent)
            }
        }
    }
}
