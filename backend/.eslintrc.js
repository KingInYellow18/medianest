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