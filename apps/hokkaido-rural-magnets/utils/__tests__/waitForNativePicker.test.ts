import { InteractionManager, Platform } from 'react-native';

import { waitForNativePicker } from '../waitForNativePicker';

describe('waitForNativePicker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('waits for interactions and adds iOS delay', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((task) => {
      task();
      return { cancel: jest.fn() };
    });

    const promise = waitForNativePicker();
    jest.advanceTimersByTime(450);

    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves after interactions on Android without extra delay', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((task) => {
      task();
      return { cancel: jest.fn() };
    });

    await expect(waitForNativePicker()).resolves.toBeUndefined();
  });
});
