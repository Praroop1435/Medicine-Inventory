import * as N from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { PermissionStatus } from '../Permission';
import type { Notifier } from './Notifier';

const CHANNEL = 'reminders';

// Show reminders even while the app is open.
N.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Android 13+ only shows the permission prompt once a channel exists.
let channel: Promise<unknown> | null = null;
const ensureChannel = () =>
  (channel ??= N.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    importance: AndroidImportance.DEFAULT,
  }));

let lastTap = '';

export const expoNotifier: Notifier = {
  getPermission: async () => (await N.getPermissionsAsync()).status as PermissionStatus,
  async requestPermission() {
    await ensureChannel();
    return (await N.requestPermissionsAsync()).granted;
  },
  async scheduleDaily(id, time, title, body, data) {
    const [hour, minute] = time.split(':').map(Number);
    await ensureChannel();
    await N.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, data },
      trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
    });
  },
  cancel: (id) => N.cancelScheduledNotificationAsync(id),
  onTap(cb) {
    const open = (r: N.NotificationResponse | null) => {
      if (!r) return;
      // On a cold start the same tap can arrive as the last response and through the listener.
      const key = `${r.notification.request.identifier}@${r.notification.date}`;
      if (key === lastTap) return;
      lastTap = key;
      N.clearLastNotificationResponse(); // so a remount doesn't open it again
      cb(r.notification.request.content.data as Record<string, string>);
    };
    open(N.getLastNotificationResponse()); // the tap that started the app
    const sub = N.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  },
};
