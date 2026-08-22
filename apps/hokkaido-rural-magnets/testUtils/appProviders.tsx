import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nProvider } from '../i18n';
import { StationGroupsProvider } from '../hooks/useStationGroups';
import { StationProgressProvider } from '../hooks/useStationProgress';

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function AppTestProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <I18nProvider>
        <StationProgressProvider>
          <StationGroupsProvider>{children}</StationGroupsProvider>
        </StationProgressProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
