/** @type {import('lint-staged').Config} */
module.exports = {
  '**/*.{js,jsx,ts,tsx}': [
    'prettier --write',
    'eslint --fix --cache',
  ],
  '**/*.{json,md,yml,yaml}': [
    'prettier --write',
  ],
};
