import css from '@eslint/css';
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import { defineConfig } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    { ignores: ['dist/**', 'node_modules/**', 'pnpm-lock.yaml'] },
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
        plugins: { js },
        extends: ['js/recommended'],
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
    },
    {
        files: ['src/**/*.{ts,mts,cts}'],
        extends: tseslint.configs.strictTypeChecked,
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: new URL('.', import.meta.url).pathname,
            },
        },
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'error',
        },
    },
    {
        files: ['**/*.json'],
        plugins: { json },
        language: 'json/json',
        extends: ['json/recommended'],
    },
    {
        files: ['**/*.jsonc'],
        plugins: { json },
        language: 'json/jsonc',
        extends: ['json/recommended'],
    },
    {
        files: ['**/*.json5'],
        plugins: { json },
        language: 'json/json5',
        extends: ['json/recommended'],
    },
    {
        files: ['**/*.md'],
        plugins: { markdown },
        language: 'markdown/gfm',
        extends: ['markdown/recommended'],
    },
    {
        files: ['**/*.css'],
        plugins: { css },
        language: 'css/css',
        extends: ['css/recommended'],
        rules: {
            'css/no-unmatchable-selectors': 'off',
            'css/no-duplicate-keyframe-selectors': 'off',
            'css/use-baseline': ['error', { available: 'newly' }],
        },
    },
    { ...eslintPluginPrettierRecommended, files: ['**/*.{js,mjs,cjs,ts,mts,cts}'] },
]);
