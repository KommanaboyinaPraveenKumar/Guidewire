import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        background: "#0a0c10",
        surface: "#111318",
        border: "#1e2330",
        accent: "#e84b3a",
        "accent-dim": "#7f2318",
        muted: "#4a5168",
        text: "#d4d8e8",
        "text-dim": "#6b7280",
      },
    },
  },
  plugins: [],
};
export default config;