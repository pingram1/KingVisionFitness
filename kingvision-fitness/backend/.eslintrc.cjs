/* eslint-env node */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist', 'node_modules', '**/*.js'],
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        // Express global augmentation requires `declare global { namespace Express { ... } }`.
        '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
      },
    },
  ],
};
