const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const importPlugin = require("eslint-plugin-import");
const prettier = require("eslint-plugin-prettier");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const js = require("@eslint/js");

module.exports = [
    // Ignore patterns
    {
        ignores: [
            "node_modules/**",
            ".next/**",
            "out/**",
            "dist/**",
            "build/**",
            "coverage/**",
            "**/*.d.ts",
            "**/*.config.js",
            "**/*.config.ts",
            "next.config.js",
            "tailwind.config.js",
            "postcss.config.js",
            "vitest.config.ts",
            "server.js",
            "eslint.config.js",
            ".eslintrc.js",
        ],
    },
    
    // JavaScript files
    {
        files: ["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2022,
            },
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            react,
            "react-hooks": reactHooks,
            import: importPlugin,
            prettier,
        },
        rules: {
            ...js.configs.recommended.rules,
            // React specific
            "react/react-in-jsx-scope": "off",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            
            // General rules
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "prefer-const": "error",
            "no-debugger": "error",
            "prettier/prettier": "error",
            "import/no-duplicates": "error",
        },
        settings: {
            react: {
                version: "detect",
            },
        },
    },
    
    // TypeScript files  
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2022,
            },
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                tsconfigRootDir: __dirname,
                project: ["./tsconfig.json"],
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            "@typescript-eslint": typescriptEslint,
            react,
            "react-hooks": reactHooks,
            // "@next/next": nextPlugin,
            import: importPlugin,
            prettier,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...typescriptEslint.configs.recommended.rules,
            
            // Next.js specific rules will be handled by Next.js built-in ESLint
            
            // React specific
            "react/react-in-jsx-scope": "off",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            
            // TypeScript specific
            "no-unused-vars": "off", // Turn off base rule
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-var-requires": "off", // Allow require() in config files
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
            react: {
                version: "detect",
            },
            "import/parsers": {
                "@typescript-eslint/parser": [".ts", ".tsx"],
            },
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                    project: ["./tsconfig.json"],
                },
                node: {
                    extensions: [".js", ".jsx", ".ts", ".tsx"],
                },
            },
        },
    },
];