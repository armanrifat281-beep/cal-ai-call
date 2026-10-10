/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // react-native-worklets ships a resolver that skips its `.native` modules,
  // which otherwise try to reach the native runtime and throw under Node.
  resolver: '<rootDir>/node_modules/react-native-worklets/jest/resolver.js',
  // supabase/functions holds the Edge Function's pure modules, which are
  // plain TypeScript and worth testing even though the function itself runs
  // on Deno.
  roots: ['<rootDir>/src', '<rootDir>/app', '<rootDir>/supabase/functions'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/index.ts',
    '!src/**/*.d.ts',
  ],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
