/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import bootRescheduleTask from './src/alarms/bootRescheduleTask';
import { handleNotifeeEvent } from './src/alarms';

// Must be registered at the root bundle entry point so background events
// (alarm delivery, dismiss, daily sentinel) are handled even when the app is terminated.
notifee.onBackgroundEvent(handleNotifeeEvent);

AppRegistry.registerComponent(appName, () => App);
// Started by the native AlarmBootReceiver on BOOT_COMPLETED — must be
// registered here, at the JS entry point, since a headless launch never
// reaches App.tsx.
AppRegistry.registerHeadlessTask('RescheduleAlarmsOnBoot', () => bootRescheduleTask);
