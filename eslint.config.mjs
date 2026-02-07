import nx from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";
import checkFilePlugin from "eslint-plugin-check-file";

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    ...tseslint.configs.recommended,
    {
        ignores: [
            "**/dist",
            "**/out-tsc",
            "**/node_modules"
        ]
    },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [],
                    depConstraints: [
                        {
                            sourceTag: "*",
                            onlyDependOnLibsWithTags: ["*"]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/naming-convention": [
                "error",
                { selector: "class", format: ["PascalCase"] },
                { selector: "interface", format: ["PascalCase"] },
                { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
                { selector: "function", format: ["camelCase"] }
            ],
            "no-console": ["warn", { allow: ["warn", "error"] }]
        }
    },
    {
        files: ["**/*"],
        plugins: {
            "check-file": checkFilePlugin,
        },
        rules: {
            "check-file/folder-naming-convention": [
                "error",
                {
                    "**/*": "KEBAB_CASE",
                },
            ],
            "check-file/filename-naming-convention": [
                "error",
                {
                    "**/*": "KEBAB_CASE",
                },
                {
                    ignoreMiddleExtensions: true,
                },
            ],
        },
    },
];
