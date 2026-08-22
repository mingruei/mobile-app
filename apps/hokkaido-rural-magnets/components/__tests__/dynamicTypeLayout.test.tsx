import { PixelRatio } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { CheckOption } from '../CheckOption';
import { GroupsScreen } from '../GroupsScreen';
import { LocationFilters } from '../LocationFilters';
import { SettingsScreen } from '../SettingsScreen';
import { StationList } from '../StationList';
import { AppTestProviders } from '../../testUtils/appProviders';
import { DYNAMIC_TYPE_TEST_SCALES } from '../../utils/dynamicType';
import { createStation } from '../../utils/__tests__/fixtures';

jest.mock('../../utils/stationProgressStorage', () => ({
  loadProgressMap: jest.fn(async () => ({
    1: { visited: true, magnet: false, magnetNotSold: false },
  })),
  saveProgressMap: jest.fn(async () => undefined),
}));

jest.mock('../../utils/stationGroupStorage', () => ({
  loadStationGroups: jest.fn(async () => []),
  saveStationGroups: jest.fn(async () => undefined),
  createStationGroupId: jest.fn(() => 'group-test-1'),
}));

jest.mock('../../hooks/useTipJar', () => ({
  useTipJar: () => ({
    connected: false,
    tipProduct: null,
    purchaseTip: jest.fn(),
    status: 'idle',
    isPurchasing: false,
  }),
}));

jest.mock('../../utils/preloadCollectibleBackup', () => ({
  preloadCollectibleBackup: jest.fn(),
}));

jest.mock('../../utils/collectibleBackup', () => ({
  exportCollectibleArchive: jest.fn(),
  pickCollectibleArchive: jest.fn(),
  processCollectibleImport: jest.fn(),
}));

function getMinHeight(node: { props: { style?: unknown } }): number | undefined {
  const flattenedStyle = Array.isArray(node.props.style)
    ? Object.assign({}, ...node.props.style.filter(Boolean))
    : node.props.style;

  return flattenedStyle?.minHeight;
}

function mockFontScale(fontScale: number) {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(fontScale);
}

describe('Dynamic Type layout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each(DYNAMIC_TYPE_TEST_SCALES)('fontScale %s', (fontScale) => {
    beforeEach(() => {
      mockFontScale(fontScale);
    });

    it('renders station list rows with accessibility labels', async () => {
      const station = createStation({
        id: 1,
        name: '帯広市',
        nameZh: '帶廣市',
        nameEn: 'Obihiro',
      });

      const { getByLabelText } = render(
        <AppTestProviders>
          <StationList stations={[station]} onSelectStation={jest.fn()} />
        </AppTestProviders>,
      );

      await waitFor(() => {
        expect(getByLabelText(/帯広市/)).toBeTruthy();
      });
    });

    it('renders filter fields with touch-friendly targets', () => {
      const { getByLabelText } = render(
        <AppTestProviders>
          <LocationFilters
            prefecture={null}
            progressFilter="all"
            prefectureOptions={[
              { value: null, label: '全部' },
              { value: '道央', label: '道央' },
            ]}
            onPrefectureChange={jest.fn()}
            onProgressFilterChange={jest.fn()}
          />
        </AppTestProviders>,
      );

      const prefectureField = getByLabelText(/北海道次區/);
      expect(prefectureField).toBeTruthy();

      const flattenedStyle = Array.isArray(prefectureField.props.style)
        ? Object.assign({}, ...prefectureField.props.style.filter(Boolean))
        : prefectureField.props.style;

      expect(flattenedStyle.minHeight).toBeGreaterThanOrEqual(44);
    });

    it('renders checkbox options without truncating labels', () => {
      const { getByLabelText } = render(
        <AppTestProviders>
          <CheckOption label="已造訪" checked={false} onToggle={jest.fn()} />
        </AppTestProviders>,
      );

      expect(getByLabelText('已造訪')).toBeTruthy();
    });

    it('renders groups screen with touch-friendly header and actions', async () => {
      const station = createStation({
        id: 1,
        name: '帯広市',
        nameZh: '帶廣市',
        nameEn: 'Obihiro',
      });

      const { getByLabelText } = render(
        <AppTestProviders>
          <GroupsScreen stations={[station]} onBack={jest.fn()} />
        </AppTestProviders>,
      );

      await waitFor(() => {
        expect(getByLabelText('返回')).toBeTruthy();
      });

      const backButton = getByLabelText('返回');
      expect(getMinHeight(backButton)).toBeGreaterThanOrEqual(44);

      const addGroupButton = getByLabelText('新增群組');
      expect(getMinHeight(addGroupButton)).toBeGreaterThanOrEqual(44);
    });

    it('renders settings screen with touch-friendly backup actions', () => {
      const { getByLabelText } = render(
        <AppTestProviders>
          <SettingsScreen onBack={jest.fn()} />
        </AppTestProviders>,
      );

      const backButton = getByLabelText('返回');
      expect(getMinHeight(backButton)).toBeGreaterThanOrEqual(44);

      const exportButton = getByLabelText('匯出備份');
      expect(getMinHeight(exportButton)).toBeGreaterThanOrEqual(44);

      const importButton = getByLabelText('匯入備份');
      expect(getMinHeight(importButton)).toBeGreaterThanOrEqual(44);
    });
  });
});
