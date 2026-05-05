/** @type {import('eslint').Linter.Config} */
/* eslint-env node */
module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'coverage/',
    'babel.config.js',
    'scripts/',
    'jest.config.js',
  ],
};
