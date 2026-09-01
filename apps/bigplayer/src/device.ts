import { Platform } from 'react-native';

export function isTabletDevice() {
  return Platform.OS === 'ios' && Platform.isPad === true;
}
