const typescriptRules = {
	'@typescript-eslint/no-explicit-any': ['off'],
	'@typescript-eslint/ban-types': ['off']
}

module.exports = {
	"root": true,
	"parser": "vue-eslint-parser",
	"parserOptions": {
		"parser": "@typescript-eslint/parser",
		"sourceType": "module"
	},
	"env": {
		"browser": true,
		"node": true,
		"es6": true
	},
	"plugins": [
		'@typescript-eslint',
		'@stylistic/js'
	],
	"ignorePatterns": ["./example/**/*", 'dist/**/*.*'],
	"extends": [
		"eslint:recommended",
		"plugin:vue/essential",
		"plugin:vue/recommended",
		"plugin:vue/vue3-essential",
		"@vue/eslint-config-typescript"
	],
	"overrides": [
		{
			"files": ['*.ts', '*.tsx'],
			"parser": '@typescript-eslint/parser'
		},
	],
	"rules": {
		"@stylistic/js/indent": ["error", 2],
		"@stylistic/js/brace-style": ["error", "1tbs", { "allowSingleLine": false }],

		"curly": ["error", "all"],
		"eqeqeq": "error",
		"object-curly-spacing": ["error", "always"],
		"keyword-spacing": [
			"error"
		],
		"key-spacing": "error",

		"vue/multi-word-component-names": "off",
		"vue/space-infix-ops": "error",
		"vue/html-indent": ["error", 2],
		"vue/object-curly-spacing": ["error", "always"],
		"vue/eqeqeq": "error",
		"vue/max-attributes-per-line": ["error", {
			"singleline": {
				"max": 4
			},
			"multiline": {
				"max": 1
			}
		}],
		"vue/no-v-for-template-key-on-child": ["off"],
		"vue/no-deprecated-slot-attribute": ["off"],

		...typescriptRules
	}
}
