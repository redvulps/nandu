import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default defineConfig([
  // Base ESLint recommended config
  eslint.configs.recommended,

  // TypeScript ESLint recommended configs
  ...tseslint.configs.recommendedTypeChecked,

  // Prettier config to disable conflicting rules
  prettier,

  // Main configuration
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js'],
          defaultProject: 'tsconfig.json',
        },
        tsconfigRootDir: import.meta.dirname,
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNullish: true },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'prettier/prettier': 'error',
      curly: 'error',
    },
  },

  // Ignore patterns (previously in .eslintignore)
  {
    ignores: ['types/**', 'gi-types/**', '_build/**', 'node_modules/**'],
  },
]);
