const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const importPlugin = require("eslint-plugin-import");
const prettier = require("eslint-plugin-prettier");
const js = require("@eslint/js");

module.exports = [
    // Ignore patterns for all configs
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "build/**",
            ".next/**",
            "coverage/**",
            "**/*.d.ts",
            "**/*.config.js",
            "**/*.config.ts",
            ".eslintrc.js",
            "eslint.config.js",
            ".lintstagedrc.js",
            "lint-staged.config.js",
            "scripts/**/*.js",
            "**/scripts/**",
            ".claude/**",
            "**/dist/**",
            "**/build/**",
            "**/__tests__/**",
            "**/tests/**",
        ],
    },
    
    // Base JavaScript configuration
    {
        files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
            ecmaVersion: 2022,
            sourceType: "module",
        },
        plugins: {
            import: importPlugin,
            prettier,
        },
        rules: {
            ...js.configs.recommended.rules,
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "prefer-const": "error",
            "no-debugger": "error",
            "prettier/prettier": "error",
            "import/no-duplicates": "error",
        },
    },
    
    // TypeScript configuration for backend
    {
        files: ["backend/**/*.ts", "backend/**/*.tsx"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                tsconfigRootDir: __dirname + "/backend",
                project: ["./tsconfig.json"],
            },
        },
        plugins: {
            "@typescript-eslint": typescriptEslint,
            import: importPlugin,
            prettier,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...typescriptEslint.configs.recommended.rules,
            
            // TypeScript rules
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/no-var-requires": "warn",
            "no-undef": "off", // TypeScript handles this
            
            // Import rules
            "import/order": [
                "error",
                {
                    groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
                    "newlines-between": "always",
                    alphabetize: { order: "asc", caseInsensitive: true },
                },
            ],
            "import/no-duplicates": "error",
            "import/no-unresolved": "error",
            
            // General rules
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "prefer-const": "error",
            "no-debugger": "error",
            "prettier/prettier": "error",
        },
        settings: {
            "import/parsers": {
                "@typescript-eslint/parser": [".ts", ".tsx"],
            },
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                    project: ["./backend/tsconfig.json"],
                },
            },
        },
    },
    
    // TypeScript configuration for shared
    {
        files: ["shared/**/*.ts", "shared/**/*.tsx"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                tsconfigRootDir: __dirname + "/shared",
                project: ["./tsconfig.json"],
            },
        },
        plugins: {
            "@typescript-eslint": typescriptEslint,
            import: importPlugin,
            prettier,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...typescriptEslint.configs.recommended.rules,
            
            // TypeScript rules
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/no-var-requires": "warn",
            "no-undef": "off", // TypeScript handles this
            
            // Import rules
            "import/order": [
                "error",
                {
                    groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
                    "newlines-between": "always",
                    alphabetize: { order: "asc", caseInsensitive: true },
                },
            ],
            "import/no-duplicates": "error",
            "import/no-unresolved": "error",
            
            // General rules
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "prefer-const": "error",
            "no-debugger": "error",
            "prettier/prettier": "error",
        },
        settings: {
            "import/parsers": {
                "@typescript-eslint/parser": [".ts", ".tsx"],
            },
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                    project: ["./shared/tsconfig.json"],
                },
            },
        },
    },
];