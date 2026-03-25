import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default tseslint.config(
    {
        // Файлы, которые нужно проверять
        files: ["src/**/*.ts"],

        // Настройки языка и парсера
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: "./tsconfig.json",
                ecmaVersion: "latest",
                sourceType: "module",
            },
            globals: {
                ...globals.node,
            },
        },

        // Правила, которые нужно применить
        extends: [
            ...tseslint.configs.recommended,
        ],

        rules: {
            // Ваши кастомные правила здесь
            "indent": ["error", 2],
            "quotes": ["error", "single"],
            "semi": ["error", "always"],
        },
    },
    // Интеграция с Prettier
    eslintPluginPrettierRecommended,
);