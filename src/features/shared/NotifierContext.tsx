import { createContext, useContext } from 'react';
import { silentNotifier, type Notifier } from '@/services/notifications/Notifier';

// The root layout provides the expo notifier; tests get a silent one unless they pass a fake.
const NotifierContext = createContext<Notifier>(silentNotifier);
export const NotifierProvider = NotifierContext.Provider;
export const useNotifier = (): Notifier => useContext(NotifierContext);
