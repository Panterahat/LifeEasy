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

object AlarmStorage {
    private const val PREFS_NAME = "scheduled_alarms_prefs"
    private const val KEY_PREFIX = "alarm_"

    data class AlarmEntry(
        val rawId: String,
        val triggerAtMillis: Long,
        val title: String,
        val message: String,
        val isRecurring: Boolean
    )

    fun saveAlarm(context: Context, rawId: String, triggerAtMillis: Long, title: String, message: String, isRecurring: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = JSONObject().apply {
            put("rawId", rawId)
            put("triggerAtMillis", triggerAtMillis)
            put("title", title)
            put("message", message)
            put("isRecurring", isRecurring)
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
                            isRecurring = json.optBoolean("isRecurring", false)
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

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d("AlarmReceiver", "Received ACTION_BOOT_COMPLETED: rescheduling active alarms...")
            rescheduleAllAlarms(context)
            return
        }

        val rawId = intent.getStringExtra("rawId") ?: intent.getIntExtra("id", 0).toString()
        val title = intent.getStringExtra("title") ?: "Daily Reminder 🔔"
        val message = intent.getStringExtra("message")

        // CRITICAL GHOST ALARM KILLER:
        // Reject orphan/legacy ghost alarms from old builds that had empty messages or fallback "Time for your reminder!"
        if (message.isNullOrBlank() || message == "Time for your reminder!" || rawId == "0" || rawId.isEmpty()) {
            // Do NOT notify and do NOT reschedule. Kill the orphan alarm immediately.
            return
        }

        val safeId = getSafeAlarmId(rawId)
        val isRecurring = intent.getBooleanExtra("isRecurring", false)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "daily_reminders_channel_v2"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Daily Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Daily scheduled heads-up notifications"
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
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(defaultSoundUri)
            .setVibrate(longArrayOf(0, 250, 250, 250))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        notificationManager.notify(safeId, builder.build())

        // Update persistence: if recurring, reschedule for 24 hours later (+86400000 ms); otherwise remove
        if (isRecurring) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                val nextTrigger = System.currentTimeMillis() + 86400000L
                AlarmStorage.saveAlarm(context, rawId, nextTrigger, title, message, true)

                val nextIntent = Intent(context, AlarmReceiver::class.java).apply {
                    putExtra("id", safeId)
                    putExtra("rawId", rawId)
                    putExtra("title", title)
                    putExtra("message", message)
                    putExtra("isRecurring", true)
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
                    triggerTime += 86400000L
                }
                AlarmStorage.saveAlarm(context, alarm.rawId, triggerTime, alarm.title, alarm.message, true)
            } else if (triggerTime <= now) {
                // Expired non-recurring alarm
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
