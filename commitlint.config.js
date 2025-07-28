/**
 * @type {import('@commitlint/types').UserConfig}
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Customize rules if needed
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation changes
        'style',    // Code style changes (formatting, etc)
        'refactor', // Code refactoring
        'perf',     // Performance improvements
        'test',     // Adding or updating tests
        'build',    // Build system changes
        'ci',       // CI/CD changes
        'chore',    // Other changes that don't modify src or test files
        'revert'    // Reverting a previous commit
      ]
    ],
    'scope-enum': [
      2,
      'always',
      [
        'frontend',
        'backend',
        'shared',
        'deps',
        'docker',
        'docs',
        'config'
      ]
    ],
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case']
    ],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always']
  }
};