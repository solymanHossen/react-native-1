package com.myapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

/**
 * Android drops every AlarmManager entry on reboot — this is what makes a
 * scheduled dose alarm survive a power cycle. It does no work itself; it
 * just starts [AlarmRescheduleService], which hands off to the
 * "RescheduleAlarmsOnBoot" Headless JS task (registered in index.js) to
 * re-read the DB and recreate every active alarm from scratch.
 */
class AlarmBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      // Kotlin resolves an inherited companion member only through the
      // class that actually declares it, not through the subclass name.
      HeadlessJsTaskService.acquireWakeLockNow(context)
      context.startService(Intent(context, AlarmRescheduleService::class.java))
    }
  }
}
