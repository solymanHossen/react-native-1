// Manual Jest mock for @notifee/react-native — the real module checks for
// its native TurboModule at import time ("Notifee native module not
// found"), which throws outside a native runtime. Covers only what this
// app's src/alarms/* actually calls.
const notifee = {
  createChannel: jest.fn().mockResolvedValue('medication-alarms'),
  requestPermission: jest.fn().mockResolvedValue({}),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  onForegroundEvent: jest.fn().mockReturnValue(() => {}),
  onBackgroundEvent: jest.fn(),
  createTriggerNotification: jest.fn().mockResolvedValue('mock-notification-id'),
  cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
  cancelTriggerNotifications: jest.fn().mockResolvedValue(undefined),
  getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  displayNotification: jest.fn().mockResolvedValue('mock-notification-id'),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
  getNotificationSettings: jest.fn().mockResolvedValue({ android: { alarm: 1 } }),
  openAlarmPermissionSettings: jest.fn().mockResolvedValue(undefined),
};

module.exports = {
  __esModule: true,
  default: notifee,
  EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 },
  AndroidImportance: { NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4 },
  AndroidVisibility: { SECRET: -1, PRIVATE: 0, PUBLIC: 1 },
  AndroidNotificationSetting: { NOT_SUPPORTED: -1, DISABLED: 0, ENABLED: 1 },
  AndroidCategory: { ALARM: 'alarm', CALL: 'call', MESSAGE: 'msg' },
  AlarmType: { SET: 0, SET_AND_ALLOW_WHILE_IDLE: 1, SET_EXACT: 2, SET_EXACT_AND_ALLOW_WHILE_IDLE: 3, SET_ALARM_CLOCK: 4 },
  TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
};
