export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/** One OS permission (notifications, camera, microphone). */
export interface Permission {
  getPermission(): Promise<PermissionStatus>;
  /** Shows the system prompt when Android still allows it; resolves true when granted. */
  requestPermission(): Promise<boolean>;
}
