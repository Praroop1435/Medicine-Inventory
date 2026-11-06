import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { tokens } from '@/ui';
import { errorCopy, ToastProvider, useToast } from '../Toast';

function Trigger() {
  const toast = useToast();
  return (
    <Pressable onPress={() => toast("Couldn't save: offline")}>
      <Text>go</Text>
    </Pressable>
  );
}

it('shows a message at the bottom and hides it after about 4 s', async () => {
  jest.useFakeTimers();
  await render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  await fireEvent.press(screen.getByText('go'));
  expect(screen.getByText("Couldn't save: offline")).toBeOnTheScreen();
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(screen.queryByText("Couldn't save: offline")).toBeNull();
  jest.useRealTimers();
});

it('sits above the tab bar and docked footers, plus the bottom inset', async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 0, left: 0, right: 0, bottom: 24 }}>
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    </SafeAreaInsetsContext.Provider>,
  );
  await fireEvent.press(screen.getByText('go'));
  expect(StyleSheet.flatten(screen.getByTestId('toast').props.style).bottom).toBe(
    24 + tokens.toastOffset,
  );
});

describe('errorCopy', () => {
  const FALLBACK = "Couldn't save. Check the connection and try again.";
  it.each([
    [new Error('write refused'), "Couldn't save that change. Try again."],
    [new Error('device is not a member of this shop'), 'This phone was removed from the shop.'],
    [
      Object.assign(
        new Error('[firestore/permission-denied] Missing or insufficient permissions.'),
        {
          code: 'firestore/permission-denied',
        },
      ),
      'This phone was removed from the shop.',
    ],
    [
      Object.assign(new Error('The service is currently unavailable.'), {
        code: 'firestore/unavailable',
      }),
      'No internet. Your change is saved on this phone and will sync.',
    ],
    [
      new TypeError('Network request failed'),
      'No internet. Your change is saved on this phone and will sync.',
    ],
    [new Error('cannot read property x of undefined'), FALLBACK],
    ['a string', FALLBACK],
    [null, FALLBACK],
  ])('%p → %p', (e, copy) => expect(errorCopy(e, FALLBACK)).toBe(copy));
});
