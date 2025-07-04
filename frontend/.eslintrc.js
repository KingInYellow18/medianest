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