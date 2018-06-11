module.exports = {
  parser: 'babel-eslint',
  env: { node: true },
  plugins: ['prettier', 'flowtype'],
  extends: ['problems', 'plugin:prettier/recommended'],
  overrides: [
    {
      files: ['**/*.test.js', '__tests__/**/*.js'],
      env: { jest: true },
    },
  ],
};
