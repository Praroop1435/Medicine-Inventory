import { router, type Href } from 'expo-router';

/** Replaces the whole history with `href`, so Back can't return to finished onboarding steps. */
export function resetTo(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
