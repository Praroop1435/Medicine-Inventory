import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { alertCounts } from '@/domain/alerts';
import { shopNightTime } from '@/domain/types';
import { dailyMessage, dueCategory, nightReminder } from '@/services/notifications/message';
import { useNotifier } from '../NotifierContext';
import { useInventory } from './useInventory';
import { useShop } from './useShop';
import { useToday } from './useToday';

// A reminder that fails to schedule is retried on the next change; nothing is lost.
const ignore = () => {};

/** Keeps the morning expiry alert and the night stock reminder in step with the shop. Mount once. */
export function useDailyAlert() {
  const notifier = useNotifier();
  const shop = useShop();
  const { batches, categories, loading } = useInventory();
  const today = useToday();

  const ready = !!shop && !loading;
  const counts = shop && ready ? alertCounts(batches, today, shop.alertDays) : null;
  const morning = shop && counts ? dailyMessage(counts, shop.alertDays) : null;
  const morningUrl = counts?.expired
    ? '/alerts/expired'
    : counts?.soon
      ? '/alerts/soon'
      : '/alerts/watch';
  const night = ready ? nightReminder(categories, today) : null;
  const due = ready ? dueCategory(categories) : undefined;
  const nightUrl = due ? `/check/${due.id}` : '/check';
  const notifyTime = shop?.notifyTime;
  const nightTime = shop && shopNightTime(shop);

  // Strings only, so a new snapshot with the same text doesn't reschedule.
  useEffect(() => {
    if (!ready || !notifyTime) return;
    if (morning)
      notifier
        .scheduleDaily('morning', notifyTime, 'Expiry alert', morning, { url: morningUrl })
        .catch(ignore);
    else notifier.cancel('morning').catch(ignore);
  }, [notifier, ready, notifyTime, morning, morningUrl]);

  useEffect(() => {
    if (!night || !nightTime) return;
    notifier
      .scheduleDaily('night', nightTime, 'Stock update', night, { url: nightUrl })
      .catch(ignore);
  }, [notifier, nightTime, night, nightUrl]);

  useEffect(() => notifier.onTap((d) => d.url && router.push(d.url as Href)), [notifier]);
}
