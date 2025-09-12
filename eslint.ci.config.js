// CI-only ESLint config: enable type-aware rules and strictness
// This file extends the base flat config by adding parserOptions.projectService
// and enforcing a small set of type-aware rules that are valuable in CI.

import base from './eslint.config.js';

/** @type {import('eslint').Linter.FlatConfig[]} */
const typedAugment = [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        // Ask TS for type info per file
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce a couple of high-signal type-aware rules in CI
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
];

export default [...base, ...typedAugment];

