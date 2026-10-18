import js from '@eslint/js'
import globals from 'globals'
import vue from 'eslint-plugin-vue'

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...vue.configs['flat/base'],
  {
    files: ['src/**/*.js', 'demos/**/*.js', 'demos/**/*.vue', 'eslint.config.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      complexity: ['error', 15],
    },
  },
]