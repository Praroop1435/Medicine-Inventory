import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { tokens } from '@/ui';
import { ToastProvider, useToast } from '../Toast';

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
