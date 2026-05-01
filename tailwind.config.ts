import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201b",
        field: "#ecf6f1",
        mint: "#1b7f5a",
        clay: "#be684d",
        amber: "#d79b28",
        steel: "#455e70"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 32, 27, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
