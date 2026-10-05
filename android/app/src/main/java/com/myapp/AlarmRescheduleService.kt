package com.myapp

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Hands the boot receiver off to the "RescheduleAlarmsOnBoot" JS task (see index.js). */
class AlarmRescheduleService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    return HeadlessJsTaskConfig(
      "RescheduleAlarmsOnBoot",
      Arguments.createMap(),
      30000L,
      true,
    )
  }
}
