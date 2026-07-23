import type { Config } from "tailwindcss";

// ZGadai — tema finance/pegadaian: brand NAVY + aksen EMAS, status
// emerald/amber/merah. Light-mode, angka tabular (enak dibaca kasir).
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f1f5fb",
          100: "#e2e9f4",
          200: "#c5d3e9",
          300: "#9db0d6",
          400: "#6b83b0",
          500: "#43608f",
          600: "#2c4677",
          700: "#1e3160",
          800: "#142347",
          900: "#0b1a3a",
          950: "#071026",
        },
        gold: {
          50: "#fbf7ec",
          100: "#f6ecce",
          200: "#ecd79b",
          300: "#e2c268",
          400: "#d9ad3a",
          500: "#c99a2e",
          600: "#a67b23",
          700: "#835d20",
          800: "#6d4d22",
          900: "#5d4222",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(11,26,58,0.06), 0 1px 2px rgba(11,26,58,0.04)",
        pop: "0 10px 30px rgba(11,26,58,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
