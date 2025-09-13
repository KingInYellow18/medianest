// Staging Mode ESLint Configuration  
// Focus: Moderate strictness - prepare for production standards while maintaining reasonable development velocity
// Usage: npm run lint:staging

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

      // CRITICAL - Enforce all safety rules
      'no-debugger': 'error', // No debugger statements in staging
      'prefer-const': 'error',
      'no-unused-vars': ['error', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',

      // QUALITY - Enforce code quality standards
      'no-console': ['warn', { allow: ['warn', 'error'] }], // Restrict console usage
      'eqeqeq': 'error', // Require strict equality
      'curly': 'error', // Require braces for all control structures
      'no-eval': 'error', // Disallow eval()
      'no-implied-eval': 'error', // Disallow implied eval()

      // STYLE - Enforce consistent styling
      'import/order': [
        'error', // Upgrade from warn
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'object', 'type'],
        },
      ],
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/no-default-export': 'warn', // Encourage named exports
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
  },

  // 3. TypeScript Config with moderate type awareness
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { modules: true, jsx: true },
        // Enable limited type awareness for staging
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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

      // CRITICAL - Full enforcement of safety rules
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-undef': 'off', // TypeScript handles this
      
      // TypeScript async safety (critical rules)
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/promise-function-async': 'error',

      // QUALITY - Enforce TypeScript best practices
      '@typescript-eslint/no-explicit-any': 'error', // Upgrade from warn/off
      '@typescript-eslint/no-unused-vars': [
        'error', // Upgrade from warn
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'error', // Upgrade from warn/off
      '@typescript-eslint/no-unsafe-function-type': 'error', // Upgrade from warn/off
      '@typescript-eslint/no-non-null-assertion': 'warn', // Discourage non-null assertions
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // PERFORMANCE & SECURITY 
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-throw-literal': 'error',

      // STYLE - Consistent code organization
      'no-console': ['error', { allow: ['warn', 'error'] }], // Stricter console enforcement
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'object', 'type'],
        },
      ],
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/no-default-export': 'warn',
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
  },

  // 4. Test/E2E Overrides - Balanced approach for testing
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
      // Keep async safety even in tests
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      
      // Moderate relaxation for test patterns
      '@typescript-eslint/no-explicit-any': 'warn', // Allow with warning in tests
      '@typescript-eslint/no-non-null-assertion': 'warn', // Allow with warning
      '@typescript-eslint/no-unused-vars': 'warn', // Allow unused test variables
      'no-console': 'off', // Allow console in tests
      'import/no-default-export': 'off', // Allow default exports in tests
      
      // Maintain some organization in tests
      'import/order': 'warn',
      'import/first': 'error',
      'import/no-duplicates': 'error',
    },
  },

  // 5. Config file overrides - Allow CommonJS patterns
  {
    files: ['**/*.config.{js,ts}', '**/.*rc.{js,ts}', '**/scripts/**/*.{js,ts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-default-export': 'off', // Config files often use default exports
      'no-console': 'off', // Allow console in scripts and configs
    },
  },

  // 6. Keep Prettier last to disable conflicting stylistic rules
  prettier,
];