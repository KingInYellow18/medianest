# ✅ COMPLETED TASK

**Original Task**: 03-linting-formatting-setup.md
**Completion Date**: January 2025
**Phase**: phase0

---

# Task: Configure ESLint and Prettier

**Priority:** High  
**Estimated Duration:** 2 hours  
**Dependencies:** 02-typescript-configuration  
**Phase:** 0 (Week 1 - Day 1)

## Objective

**Status:** ✅ Complete

Set up ESLint and Prettier with shared configurations across the monorepo, configure Git hooks with Husky for pre-commit checks, and establish consistent code quality standards.

## Background

Consistent code style and quality checks prevent bugs, improve readability, and reduce code review friction. Automated formatting and linting ensure all code meets the same standards.

## Detailed Requirements

### 1. ESLint Configuration

- Shared ESLint config for all workspaces
- TypeScript support with type checking
- React/Next.js rules for frontend
- Node.js rules for backend
- Import sorting and organization

### 2. Prettier Configuration

- Consistent formatting rules
- Integration with ESLint
- Format on save setup
- Ignore generated files

### 3. Git Hooks Setup

- Pre-commit hooks with Husky
- Lint-staged for efficient checking
- Commit message validation
- Automatic formatting on commit

### 4. IDE Integration

- VS Code settings
- Format on save
- ESLint auto-fix

## Technical Implementation Details

### Root ESLint Configuration (.eslintrc.js)

```javascript
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.base.json'],
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['./tsconfig.base.json'],
      },
    },
  },
  rules: {
    // TypeScript
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',

    // Imports
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-duplicates': 'error',
    'import/no-cycle': 'error',

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
  ],
};
```

### Frontend ESLint Configuration (frontend/.eslintrc.js)

```javascript
module.exports = {
  extends: ['../.eslintrc.js', 'next/core-web-vitals'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
    node: true,
  },
  rules: {
    // React specific
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Next.js specific
    '@next/next/no-html-link-for-pages': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

### Backend ESLint Configuration (backend/.eslintrc.js)

```javascript
module.exports = {
  extends: ['../.eslintrc.js'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
  },
  rules: {
    // Node.js specific
    'no-process-exit': 'error',
    'no-path-concat': 'error',
  },
};
```

### Prettier Configuration (.prettierrc)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "proseWrap": "preserve"
}
```

### .prettierignore

```
# Dependencies
node_modules
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build outputs
dist
build
.next
out

# Generated files
*.generated.ts
*.generated.js
coverage
*.lcov

# Other
.git
.husky
```

### Husky and Lint-staged Setup

#### .husky/pre-commit

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

#### .husky/commit-msg

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx commitlint --edit $1
```

#### lint-staged.config.js

```javascript
module.exports = {
  '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  '*.{css,scss}': ['prettier --write'],
};
```

#### commitlint.config.js

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation
        'style', // Formatting, missing semicolons, etc
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf', // Performance improvements
        'test', // Adding missing tests
        'build', // Changes to build process
        'ci', // CI configuration
        'chore', // Other changes that don't modify src or test files
        'revert', // Reverts a previous commit
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
  },
};
```

### VS Code Settings (.vscode/settings.json)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "eslint.workingDirectories": ["./frontend", "./backend", "./shared"],
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true,
    "**/build": true
  }
}
```

### Dependencies to Install

```json
{
  "devDependencies": {
    // ESLint
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "eslint-config-next": "^14.1.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.29.1",
    "eslint-plugin-prettier": "^5.1.3",
    "eslint-import-resolver-typescript": "^3.6.1",

    // Prettier
    "prettier": "^3.2.4",

    // Git hooks
    "husky": "^9.0.10",
    "lint-staged": "^15.2.0",
    "@commitlint/cli": "^18.4.4",
    "@commitlint/config-conventional": "^18.4.4"
  }
}
```

## Acceptance Criteria

1. ✅ ESLint runs without errors on all workspaces
2. ✅ Prettier formats code consistently
3. ✅ Pre-commit hooks prevent committing lint errors
4. ✅ Commit messages follow conventional format
5. ✅ Import ordering is automatic and consistent
6. ✅ VS Code integration works properly
7. ✅ CI can run lint checks
8. ✅ No conflicts between ESLint and Prettier

## Testing Requirements

1. Run `npm run lint` in each workspace
2. Make an intentional lint error and verify it's caught
3. Test pre-commit hooks by staging bad code
4. Verify auto-formatting works on save
5. Test commit message validation

## Setup Commands

```bash
# Install dependencies
npm install -D eslint prettier husky lint-staged @commitlint/cli @commitlint/config-conventional

# Install ESLint plugins
npm install -D @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier eslint-plugin-import eslint-plugin-prettier eslint-import-resolver-typescript

# Frontend specific
cd frontend && npm install -D eslint-config-next

# Initialize Husky
npx husky init

# Add git hooks
npx husky add .husky/pre-commit "npx lint-staged"
npx husky add .husky/commit-msg "npx commitlint --edit $1"

# Add scripts to package.json
npm pkg set scripts.lint="npm run lint --workspaces --if-present"
npm pkg set scripts.format="prettier --write ."
npm pkg set scripts.format:check="prettier --check ."
```

## Common Issues & Solutions

1. **ESLint can't find tsconfig**: Check parserOptions.project path
2. **Import resolver issues**: Verify eslint-import-resolver-typescript config
3. **Prettier conflicts**: Ensure eslint-config-prettier is last in extends
4. **Hooks not running**: Run `npx husky install`

## Next Steps

- Initialize Next.js application
- Set up Express server
- Configure testing framework

## Completion Notes

- Completed on: July 4, 2025
- All acceptance criteria met
- Ready for production use

## References

- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Prettier Documentation](https://prettier.io/docs/en/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [Conventional Commits](https://www.conventionalcommits.org/)
