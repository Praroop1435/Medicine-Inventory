import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { shopNightTime } from '@/domain/types';
import { dueCategory, morningAlerts, nightReminder } from '@/services/notifications/message';
import { useSession } from '@/features/onboarding/SessionContext';
import { useNotifier } from '../NotifierContext';
import { useInventory } from './useInventory';
import { useShop } from './useShop';
import { useToday } from './useToday';

// A reminder that fails to schedule is retried on the next change; nothing is lost.
const ignore = () => {};

/** Keeps the morning expiry alert and the night stock reminder in step with the shop. Mount once. */
export function useDailyAlert() {
  const notifier = useNotifier();
  const { session } = useSession();
  const shop = useShop();
  const { batches, categories, loading } = useInventory();
  const today = useToday();

  const ready = !!shop && !loading;
  // What was last scheduled, so a snapshot with the same texts doesn't reschedule.
  const scheduled = useRef('');
  const night = ready ? nightReminder(categories, today) : null;
  const due = ready ? dueCategory(categories) : undefined;
  const nightUrl = due ? `/check/${due.id}` : '/check';
  const nightTime = shop && shopNightTime(shop);

  // No shop on this phone (left or never joined): no reminders for it.
  useEffect(() => {
    if (session) return;
    scheduled.current = '';
    notifier.cancel('morning').catch(ignore);
    notifier.cancel('night').catch(ignore);
  }, [notifier, session]);

  // `today` re-runs this at midnight, so the week of mornings rolls forward.
  useEffect(() => {
    if (!ready || !shop) return;
    const list = morningAlerts(batches, shop.alertDays, shop.notifyTime, new Date());
    const key = JSON.stringify(list);
    if (key === scheduled.current) return;
    scheduled.current = key;
    (list.length ? notifier.scheduleMornings(list) : notifier.cancel('morning')).catch(() => {
      scheduled.current = ''; // retried on the next change
    });
  }, [notifier, ready, shop, batches, today]);

  // Strings only, so a new snapshot with the same text doesn't reschedule.
  useEffect(() => {
    if (!night || !nightTime) return;
    notifier
      .scheduleDaily('night', nightTime, 'Stock update', night, { url: nightUrl })
      .catch(ignore);
  }, [notifier, nightTime, night, nightUrl]);

  useEffect(() => notifier.onTap((d) => d.url && router.push(d.url as Href)), [notifier]);
}
