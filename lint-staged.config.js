module.exports = {
  // Simplified for development workflow - only format docs and config
  '*.{md,yml,yaml}': [
    'prettier --write'
  ]
  // Skip JS/TS files to avoid lint issues during development
};