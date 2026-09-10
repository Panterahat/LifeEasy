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
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra("id", System.currentTimeMillis().toInt())
        val title = intent.getStringExtra("title") ?: "Daily Reminder 🔔"
        val message = intent.getStringExtra("message") ?: "Time for your reminder!"
        val isRecurring = intent.getBooleanExtra("isRecurring", true)

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
            id,
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

        notificationManager.notify(id, builder.build())

        // If recurring, reschedule for 24 hours later (+86400000 ms)
        if (isRecurring) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                val nextIntent = Intent(context, AlarmReceiver::class.java).apply {
                    putExtra("id", id)
                    putExtra("title", title)
                    putExtra("message", message)
                    putExtra("isRecurring", true)
                }
                val nextPendingIntent = PendingIntent.getBroadcast(
                    context,
                    id,
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
