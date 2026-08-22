/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  collectCoverageFrom: [
    'utils/**/*.{ts,tsx}',
    'plugins/**/*.js',
    'hooks/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!utils/stationCollectibleStorage.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 85,
      lines: 80,
      statements: 80,
    },
    './utils/collectibleUploadErrors.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './utils/collectibleTypeDetection.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './utils/normalizeFileUri.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './utils/collectibleBackupManifest.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './utils/stationCollectibleUpload.ts': {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './utils/collectibleBackup.ts': {
      branches: 65,
      functions: 85,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js|mjs)'],
  modulePathIgnorePatterns: ['<rootDir>/android/', '<rootDir>/ios/'],
};
