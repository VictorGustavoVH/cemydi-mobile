const shared = {
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^lucide-react-native/icons/(.*)$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|nativewind|react-native-css-interop|lucide-react-native))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  clearMocks: true,
};

// Reporters belong to the root config, not to individual Jest projects.
const reportSuite =
  { 'test:unit': 'unit', 'test:integration': 'integration' }[process.env.npm_lifecycle_event] ||
  'all';

module.exports = {
  maxWorkers: 2,
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: `<rootDir>/test-results/jest/${reportSuite}`,
        outputName: 'junit.xml',
        suiteName: `CEMYDI ${reportSuite}`,
        addFileAttribute: 'true',
        reportTestSuiteErrors: 'true',
      },
    ],
  ],
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.[jt]s?(x)'],
    },
    {
      ...shared,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.[jt]s?(x)'],
    },
  ],
};
