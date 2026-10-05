/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import bootRescheduleTask from './src/alarms/bootRescheduleTask';

AppRegistry.registerComponent(appName, () => App);
// Started by the native AlarmBootReceiver on BOOT_COMPLETED — must be
// registered here, at the JS entry point, since a headless launch never
// reaches App.tsx.
AppRegistry.registerHeadlessTask('RescheduleAlarmsOnBoot', () => bootRescheduleTask);
