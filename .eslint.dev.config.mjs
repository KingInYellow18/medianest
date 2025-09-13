// Development Mode ESLint Configuration
// Focus: Velocity with basic safety - errors for critical bugs, warnings for guidance
// Usage: npm run lint:dev

import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // 1. Global Ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.vite/**',
      '**/.vitest-cache/**',
      '**/allure-results/**',
      '**/.code/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/.vercel/**',
      '**/.claude/**',
      '**/*.d.ts',
    ],
  },

  // 2. Base Config for JavaScript files
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { modules: true, jsx: true },
      },
      globals: { ...globals.browser, ...globals.node, es2022: true },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,

      // CRITICAL - Always enforce (prevent actual runtime bugs)
      'no-debugger': 'warn', // Allow debugger in dev, but warn to remove
      'prefer-const': 'error',
      'no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],

      // QUALITY - Warn for guidance without blocking development
      'no-console': 'off', // Allow console.log in development
      'no-var': 'warn',
      'object-shorthand': 'warn',
      'prefer-arrow-callback': 'warn',

      // STYLE - Minimal enforcement for dev velocity
      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'object', 'type'],
        },
      ],
      'import/first': 'warn',
      'import/newline-after-import': 'warn',
      'import/no-duplicates': 'error',
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
  },

  // 3. Base Config for TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { modules: true, jsx: true },
        // Intentionally not setting projectService for development speed
      },
      globals: { ...globals.browser, ...globals.node, es2022: true },
    },
    plugins: {
      '@typescript-eslint': ts,
      import: importPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...ts.configs.recommended.rules,

      // CRITICAL - Always enforce (async safety and basic correctness)
      'no-debugger': 'warn', // Allow debugger in dev, but warn
      'prefer-const': 'error',
      'no-undef': 'off', // TypeScript handles this
      
      // TypeScript specific critical rules (moved from CI-only based on analysis)
      '@typescript-eslint/no-floating-promises': 'error', // High impact async bug prevention
      '@typescript-eslint/no-misused-promises': 'error', // High impact async bug prevention

      // QUALITY - Warn to guide without blocking (relaxed from current config)
      '@typescript-eslint/no-explicit-any': 'warn', // Change from 'off' - provide guidance
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'warn', // Change from 'off'
      '@typescript-eslint/no-unsafe-function-type': 'warn', // Change from 'off'
      
      // STYLE - Development friendly
      'no-console': 'off', // Allow console.log in development
      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'object', 'type'],
        },
      ],
      'import/first': 'warn',
      'import/newline-after-import': 'warn',
      'import/no-duplicates': 'error',
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
  },

  // 4. Test/E2E Overrides - Maximum flexibility for test patterns
  {
    files: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      'tests/**/*.{ts,tsx,js,jsx}',
      'backend/tests/**/*.{ts,tsx}',
      'frontend/__tests__/**/*.{ts,tsx,js,jsx}',
      'backend/__tests__/**/*.{ts,tsx}',
    ],
    rules: {
      // Keep critical async safety even in tests
      '@typescript-eslint/no-floating-promises': 'error',
      
      // Relax everything else for test flexibility
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/order': 'off',
      'no-console': 'off',
      'no-debugger': 'off', // Allow debugger in tests
    },
  },

  // 5. Keep Prettier last to disable conflicting stylistic rules
  prettier,
];