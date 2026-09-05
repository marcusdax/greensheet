import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // `react-refresh/only-export-components` is a HOT-RELOAD ergonomics rule:
    // a module that exports both a component and something else loses fast
    // refresh for that file in dev. It says nothing about correctness, and
    // this repo has several files that legitimately do it — Layout exports a
    // formatter, the providers export their hooks. Reported as a warning so
    // the signal survives without CI failing over a dev-server nicety.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Vendored shadcn/ui primitives. Exporting a `cva` variants object next to
    // the component is the library's own API shape, not a choice made here, and
    // editing these files back into compliance would mean diverging from
    // upstream for no benefit.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
