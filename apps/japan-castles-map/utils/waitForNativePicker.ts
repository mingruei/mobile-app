import { InteractionManager, Platform } from 'react-native';

const IOS_PICKER_DELAY_MS = 450;

export function waitForNativePicker(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      if (Platform.OS === 'ios') {
        setTimeout(resolve, IOS_PICKER_DELAY_MS);
        return;
      }

      resolve();
    });
  });
}
