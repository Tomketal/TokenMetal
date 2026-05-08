import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".vercel/**",
      "data/**",
      "grants/**/copilot/**",
      "grants/**/package*/**",
      "pitch-deck-*.html",
      "PROJECT_CODE_BUNDLE.md"
    ]
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  }
];

export default eslintConfig;
