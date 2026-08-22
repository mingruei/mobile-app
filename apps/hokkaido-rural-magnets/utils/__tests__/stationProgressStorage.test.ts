import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { createProgressEntry } from '../../types/stationProgress';
import { loadProgressMap, saveProgressMap } from '../stationProgressStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-file-system', () => {
  const fileState = {
    exists: false,
    textContent: '{}',
  };

  class MockFile {
    exists = fileState.exists;
    uri = 'file:///mock/station-progress-v1.json';

    info = jest.fn(() => ({ size: 0 }));

    text = jest.fn(async () => fileState.textContent);

    write = jest.fn((payload: string) => {
      fileState.exists = true;
      fileState.textContent = payload;
    });
  }

  return {
    File: MockFile,
    Paths: { document: 'file:///documents' },
    __mockFileState: fileState,
  };
});

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<typeof AsyncStorage.removeItem>;
const fileSystemMock = jest.requireMock('expo-file-system') as {
  __mockFileState: { exists: boolean; textContent: string };
};

describe('stationProgressStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileSystemMock.__mockFileState.exists = false;
    fileSystemMock.__mockFileState.textContent = '{}';
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  });

  it('loads progress from document file when available', async () => {
    fileSystemMock.__mockFileState.exists = true;
    fileSystemMock.__mockFileState.textContent = JSON.stringify({
      1: createProgressEntry({ visited: true }),
    });

    const map = await loadProgressMap();
    expect(map[1]?.visited).toBe(true);
  });

  it('migrates legacy AsyncStorage progress to file storage', async () => {
    mockedGetItem.mockResolvedValue(
      JSON.stringify({
        2: createProgressEntry({ magnet: true }),
      }),
    );

    const map = await loadProgressMap();
    expect(map[2]?.magnet).toBe(true);
    expect(mockedRemoveItem).toHaveBeenCalledWith('station-progress-v1');
  });

  it('returns empty map when all reads fail', async () => {
    mockedGetItem.mockRejectedValue(new Error('storage unavailable'));
    fileSystemMock.__mockFileState.exists = false;

    await expect(loadProgressMap()).resolves.toEqual({});
  });

  it('saves progress to document file on native', async () => {
    const map = {
      1: createProgressEntry({ visited: true }),
    };

    await saveProgressMap(map);
    expect(fileSystemMock.__mockFileState.textContent).toContain('"visited":true');
  });
});
