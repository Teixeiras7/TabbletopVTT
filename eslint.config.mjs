import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "drizzle/**"],
  },
  ...nextCoreWebVitals,
];

export default config;
