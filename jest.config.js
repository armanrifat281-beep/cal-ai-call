/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Reanimated ships a resolver that skips the `.native` modules of both
  // itself and react-native-worklets, which otherwise reach for the native
  // runtime and throw under Node. From Reanimated 4.7 this is the one to
  // use: the worklets resolver alone no longer covers Reanimated's own
  // initialisers.
  resolver: '<rootDir>/node_modules/react-native-reanimated/jest/resolver.js',
  // supabase/functions holds the Edge Function's pure modules, which are
  // plain TypeScript and worth testing even though the function itself runs
  // on Deno.
  roots: ['<rootDir>/src', '<rootDir>/app', '<rootDir>/supabase/functions'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Deno resolves `npm:` specifiers natively; Node cannot. Without this,
    // `vision.ts` - which decides whether a failed analysis is retried - was
    // untestable, so that decision went unverified.
    '^npm:@anthropic-ai/sdk.*$': '<rootDir>/supabase/functions/__stubs__/anthropic.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/index.ts',
    '!src/**/*.d.ts',
  ],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
