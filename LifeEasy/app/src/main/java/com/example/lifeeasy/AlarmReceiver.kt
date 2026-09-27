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
import androidx.core.app.NotificationCompat

class AlarmReceiver : BroadcastReceiver() {
    private fun getSafeAlarmId(rawId: Any?): Int {
        if (rawId == null) return 12345678
        val str = rawId.toString().trim()
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

        // If recurring, reschedule for 24 hours later (+86400000 ms)
        if (isRecurring) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
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
                val nextTrigger = System.currentTimeMillis() + 86400000L
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTrigger, nextPendingIntent)
                } else {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTrigger, nextPendingIntent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
