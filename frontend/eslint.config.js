const { defineConfig } = require('eslint/config');

const globals = require('globals');
const js = require('@eslint/js');

const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  {
    extends: compat.extends('../.eslintrc.js', 'next/core-web-vitals'),

    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.json',
      },

      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
      '@next/next/no-img-element': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
]);
