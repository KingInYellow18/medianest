module.exports = {
  extends: ['../.eslintrc.js'],
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.test.json'],
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
  overrides: [
    {
      files: ['tests/**/*'],
      parserOptions: {
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: __dirname,
      },
      env: {
        node: true,
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  ],
};