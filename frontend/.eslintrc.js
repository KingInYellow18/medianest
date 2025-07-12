module.exports = {
  extends: ['../.eslintrc.js', 'next/core-web-vitals'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  env: {
    browser: true,
    node: true,
  },
  rules: {
    '@next/next/no-img-element': 'off',
    // React/Next.js specific rules
    'react/react-in-jsx-scope': 'off',
  },
};