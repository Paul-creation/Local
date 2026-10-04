import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 앱에서 games 표는 app/lib/visibleGames.ts의 selectGames()로만 읽는다 (숨긴 게임이 자동으로 빠지게)
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["app/lib/visibleGames.ts", "app/api/admin/**"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.property.name='from'][arguments.0.value='games']",
        message: "games는 app/lib/visibleGames.ts의 selectGames()로 읽어 주세요 (숨긴 게임 제외). 관리자 API만 예외",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
