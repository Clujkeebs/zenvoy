import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'supabase/functions/**'] },

  {
    files: ['**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // The codebase uses the new JSX transform — no React import needed.
      'react/react-in-jsx-scope': 'off',
      // Prop types aren't used anywhere; enabling this would be thousands of
      // warnings for no benefit at this size.
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',

      // Catch the class of bug that shipped the broken admin panel: a value
      // that's declared or passed and then never actually used.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Real smells, but they're spread across the existing large components
      // and fixing them is a refactor rather than a correctness change.
      // Left visible as warnings instead of blocking CI on day one.
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
  },

  {
    files: ['**/*.test.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
