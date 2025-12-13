import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	// Override default ignores of eslint-config-next.
	globalIgnores([
		// Default ignores of eslint-config-next:
		".next/**",
		"out/**",
		"build/**",
		"next-env.d.ts",
	]),
	// Add CSS rules configuration
	{
		files: ["**/*.css"],
		rules: {
			"at-rule-no-unknown": [
				"error",
				{
					ignoreAtRules: [
						"tailwind",
						"apply",
						"variants",
						"responsive",
						"screen",
						"theme",
						"custom-variant",
						"layer",
					],
				},
			],
		},
	},
]);

export default eslintConfig;
