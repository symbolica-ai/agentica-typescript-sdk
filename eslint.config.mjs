// @ts-check

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import eslintPluginImport from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';


export default [
    {
        ignores: ['dist/', 'dist-transformer/', 'node_modules/'],
    },
    ...defineConfig(
        eslint.configs.recommended,
        tseslint.configs.recommended,
        eslintPluginImport.flatConfigs.typescript,
        eslintConfigPrettier
    ),
    {
        languageOptions: {
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
            },
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'import/newline-after-import': ['error', { count: 1 }],
            'sort-imports': [
                'error',
                {
                    ignoreCase: false,
                    ignoreDeclarationSort: true,
                    ignoreMemberSort: false,
                    memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
                    allowSeparatedGroups: false,
                },
            ],
            'import/order': [
                'error',
                {
                    'newlines-between': 'always',
                    groups: [
                        'type',
                        // Imports of builtins are first
                        'builtin',
                        'external',
                        'internal',
                        // Then sibling and parent imports. They can be mingled together
                        ['sibling', 'parent'],
                        // Then index file imports
                        'index',
                        // Then any arcane TypeScript imports
                        'object',
                    ],
                    named: true,
                    alphabetize: {
                        order: 'asc',
                        orderImportKind: 'asc',
                        caseInsensitive: false,
                    },
                },
            ],
        },
    },
];
