import { requireOptionalNativeModule } from 'expo';
import { BackHandler, Platform } from 'react-native';

type ExitAppNative = {
  exitApp: () => void;
};

export function exitApp() {
  if (Platform.OS === 'android') {
    BackHandler.exitApp();
    return;
  }

  requireOptionalNativeModule<ExitAppNative>('ExitApp')?.exitApp();
}
