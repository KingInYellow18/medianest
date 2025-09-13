module.exports = {
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'no-duplicate-keys': 'error',
    'no-unreachable': 'error',
    'no-undef': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*', '**/*.test.*', '**/*.spec.*'],
      rules: {
        'no-console': 'off'
      }
    }
  ]
};