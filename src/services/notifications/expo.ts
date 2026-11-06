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
// One id per morning of the week ahead; 'morning' was the old daily repeat.
const MORNINGS = ['morning', ...Array.from({ length: 7 }, (_, i) => `morning-${i}`)];
const cancelMornings = async () => {
  await Promise.all(MORNINGS.map((id) => N.cancelScheduledNotificationAsync(id)));
};

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
  async scheduleMornings(alerts) {
    await ensureChannel();
    await cancelMornings();
    for (const [i, a] of alerts.entries())
      await N.scheduleNotificationAsync({
        identifier: `morning-${i}`,
        content: { title: a.title, body: a.body, data: a.data },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: a.at, channelId: CHANNEL },
      });
  },
  cancel: (id) => (id === 'morning' ? cancelMornings() : N.cancelScheduledNotificationAsync(id)),
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
