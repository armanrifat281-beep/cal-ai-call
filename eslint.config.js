// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'supabase/functions/*'],
  },
  {
    // Build-time scripts run under Node, not in the app bundle, so they may use
    // Node globals. The Expo config assumes a React Native environment, where
    // `Buffer` and friends do not exist.
    files: ['scripts/**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    // Jest's mock factories are hoisted above imports, so the setup file has to
    // reach for modules with `require()`, and its `useEffect` stub takes the
    // function it is given rather than an inline one.
    files: ['jest.setup.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
]);
