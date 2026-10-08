export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.cursor/**'],
  },
  {
    files: ['**/*.js', '**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
