import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: 'function' },
        { blankLine: 'always', prev: 'function', next: '*' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: 'multiline-const', next: '*' },
        { blankLine: 'always', prev: '*', next: 'multiline-const' },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      '@stylistic/jsx-first-prop-new-line': ['error', 'always'],
      '@stylistic/jsx-max-props-per-line': [
        'error',
        { maximum: 1, when: 'always' },
      ],
      '@stylistic/jsx-closing-bracket-location': ['error', 'tag-aligned'],
      '@stylistic/jsx-indent-props': ['error', 2],
    },
  },
  globalIgnores(['.next/**', 'next-env.d.ts', 'coverage/**']),
]);
