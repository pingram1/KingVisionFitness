// Default Jest setup: SecureStore is available (simulating iOS/Android) and
// backed by an in-memory map so each test sees realistic round-trip behavior.
// Individual tests can override `isAvailableAsync` to false to exercise the
// "secure storage unavailable" branch. The `mock*` prefix is required by
// Jest's out-of-scope variable rule inside jest.mock() factories.
const mockSecureStoreMap = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStoreMap.set(key, value);
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStoreMap.get(key) ?? null)),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStoreMap.delete(key);
    return Promise.resolve();
  }),
  WHEN_UNLOCKED: 0,
}));

afterEach(() => {
  mockSecureStoreMap.clear();
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));
