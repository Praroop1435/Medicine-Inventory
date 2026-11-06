import { act, renderHook } from '@testing-library/react-native';
import { useToday } from '../hooks/useToday';

describe('useToday', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 6, 23, 59, 30));
  });
  afterEach(() => jest.useRealTimers());

  it('rolls over at local midnight', async () => {
    const { result } = await renderHook(() => useToday());
    expect(result.current).toEqual(new Date(2026, 10, 6));
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current).toEqual(new Date(2026, 10, 7));
  });
});
