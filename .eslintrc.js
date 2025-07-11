module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import-x', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:import-x/recommended',
    'plugin:import-x/typescript',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.base.json', './frontend/tsconfig.json', './backend/tsconfig.json', './shared/tsconfig.json'],
  },
  settings: {
    'import-x/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import-x/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['./tsconfig.base.json', './frontend/tsconfig.json', './backend/tsconfig.json', './shared/tsconfig.json'],
      },
    },
  },
  rules: {
    // TypeScript
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: {
          attributes: false,
        },
      },
    ],
    
    // Imports
    'import-x/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import-x/no-duplicates': 'error',
    'import-x/no-cycle': 'warn',
    'import-x/no-unresolved': 'error',
    
    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-debugger': 'error',
    'prettier/prettier': 'error',
  },
  ignorePatterns: [
    'dist',
    'build',
    '.next',
    'node_modules',
    'coverage',
    '*.config.js',
    '*.config.ts',
    '*.mjs',
    'vitest.config.ts',
  ],
};