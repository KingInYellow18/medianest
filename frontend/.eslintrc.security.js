// ESLint Security Configuration for MediaNest Frontend
// Enhanced security rules for production deployment
module.exports = {
  extends: ['./.eslintrc.js', 'plugin:security/recommended'],
  plugins: ['security'],
  rules: {
    // Security-focused rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-new-buffer': 'error',

    // Additional security patterns
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
};
