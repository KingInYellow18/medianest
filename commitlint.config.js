module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        'hotfix',
        'emergency', // Special types for urgent commits
      ],
    ],
    'header-max-length': [2, 'always', 100],
    'scope-empty': [1, 'never'], // Warning only for flexibility
  },
};
