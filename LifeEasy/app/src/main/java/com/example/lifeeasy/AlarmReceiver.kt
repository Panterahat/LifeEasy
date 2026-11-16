package com.example.lifeeasy

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.util.Calendar

object AlarmStorage {
    private const val PREFS_NAME = "scheduled_alarms_prefs"
    private const val KEY_PREFIX = "alarm_"

    data class AlarmEntry(
        val rawId: String,
        val triggerAtMillis: Long,
        val title: String,
        val message: String,
        val isRecurring: Boolean,
        val days: String
    )

    fun saveAlarm(context: Context, rawId: String, triggerAtMillis: Long, title: String, message: String, isRecurring: Boolean, days: String = "") {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = JSONObject().apply {
            put("rawId", rawId)
            put("triggerAtMillis", triggerAtMillis)
            put("title", title)
            put("message", message)
            put("isRecurring", isRecurring)
            put("days", days)
        }.toString()
        prefs.edit().putString(KEY_PREFIX + rawId, json).apply()
    }

    fun removeAlarm(context: Context, rawId: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_PREFIX + rawId).apply()
    }

    fun getAllAlarms(context: Context): List<AlarmEntry> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val list = mutableListOf<AlarmEntry>()
        val all = prefs.all
        for ((key, value) in all) {
            if (key.startsWith(KEY_PREFIX) && value is String) {
                try {
                    val json = JSONObject(value)
                    list.add(
                        AlarmEntry(
                            rawId = json.getString("rawId"),
                            triggerAtMillis = json.getLong("triggerAtMillis"),
                            title = json.optString("title", ""),
                            message = json.optString("message", ""),
                            isRecurring = json.optBoolean("isRecurring", false),
                            days = json.optString("days", "")
                        )
                    )
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return list
    }
}

class AlarmReceiver : BroadcastReceiver() {

    private fun getSafeAlarmId(rawId: String?): Int {
        if (rawId == null) return 12345678
        val str = rawId.trim()
        if (str.isEmpty()) return 12345678
        val num = str.toLongOrNull()
        val id = if (num != null && num >= 0 && num <= Int.MAX_VALUE) {
            num.toInt()
        } else {
            (str.hashCode() and 0x7FFFFFFF)
        }
        return if (id == 0 || id == Int.MAX_VALUE) 12345678 else id
    }

    private fun calculateNextTrigger(fromMillis: Long, prevTrigger: Long, days: String): Long {
        val cal = Calendar.getInstance().apply {
            timeInMillis = prevTrigger
        }
        val targetDays = days.mapNotNull { it.toString().toIntOrNull() }.toSet()
        if (targetDays.isEmpty()) {
            return prevTrigger + 86400000L
        }
        repeat(7) {
            cal.add(Calendar.DAY_OF_YEAR, 1)
            val dayOfWeek = (cal.get(Calendar.DAY_OF_WEEK) - 1 + 7) % 7
            if (targetDays.contains(dayOfWeek)) {
                if (cal.timeInMillis <= fromMillis) {
                    return@repeat
                }
                return cal.timeInMillis
            }
        }
        return prevTrigger + 86400000L
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            Log.d("AlarmReceiver", "Received ${intent.action}: rescheduling active alarms...")
            rescheduleAllAlarms(context)
            return
        }

        val rawId = intent.getStringExtra("rawId") ?: intent.getIntExtra("id", 0).toString()
        val title = intent.getStringExtra("title") ?: "Alarm ⏰"
        val message = intent.getStringExtra("message")
        val days = intent.getStringExtra("days") ?: ""

        if (rawId == "0" || rawId.isEmpty()) {
            return
        }

        val safeId = getSafeAlarmId(rawId)
        val isRecurring = intent.getBooleanExtra("isRecurring", false)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "life_easy_notifications_v2"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "LifeEasy Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "LifeEasy App Notifications"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 250, 250)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            safeId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(message ?: title)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(defaultSoundUri)
            .setVibrate(longArrayOf(0, 250, 250, 250))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        notificationManager.notify(safeId, builder.build())

        val currentTrigger = intent.getLongExtra("triggerAtMillis", System.currentTimeMillis())

        if (isRecurring) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                val nextTrigger = calculateNextTrigger(System.currentTimeMillis(), currentTrigger, days)
                AlarmStorage.saveAlarm(context, rawId, nextTrigger, title, message ?: title, true, days)

                val nextIntent = Intent(context, AlarmReceiver::class.java).apply {
                    putExtra("id", safeId)
                    putExtra("rawId", rawId)
                    putExtra("title", title)
                    putExtra("message", message)
                    putExtra("isRecurring", true)
                    putExtra("days", days)
                    putExtra("triggerAtMillis", nextTrigger)
                }
                val nextPendingIntent = PendingIntent.getBroadcast(
                    context,
                    safeId,
                    nextIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTrigger, nextPendingIntent)
                } else {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTrigger, nextPendingIntent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        } else {
            AlarmStorage.removeAlarm(context, rawId)
        }
    }

    private fun rescheduleAllAlarms(context: Context) {
        val alarms = AlarmStorage.getAllAlarms(context)
        val now = System.currentTimeMillis()
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        for (alarm in alarms) {
            var triggerTime = alarm.triggerAtMillis
            if (alarm.isRecurring) {
                while (triggerTime <= now) {
                    triggerTime = calculateNextTrigger(now, triggerTime, alarm.days)
                }
                AlarmStorage.saveAlarm(context, alarm.rawId, triggerTime, alarm.title, alarm.message, true, alarm.days)
            } else if (triggerTime <= now) {
                AlarmStorage.removeAlarm(context, alarm.rawId)
                continue
            }

            val safeId = getSafeAlarmId(alarm.rawId)
            Log.d("AlarmReceiver", "Boot rescheduling alarm: rawId=${alarm.rawId}, safeId=$safeId, triggerAtMillis=$triggerTime, title=${alarm.title}")

            val intent = Intent(context, AlarmReceiver::class.java).apply {
                putExtra("id", safeId)
                putExtra("rawId", alarm.rawId)
                putExtra("title", alarm.title)
                putExtra("message", alarm.message)
                putExtra("isRecurring", alarm.isRecurring)
                putExtra("days", alarm.days)
                putExtra("triggerAtMillis", triggerTime)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                safeId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                } else {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}