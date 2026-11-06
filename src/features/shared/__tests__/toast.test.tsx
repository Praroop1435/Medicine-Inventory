import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
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
