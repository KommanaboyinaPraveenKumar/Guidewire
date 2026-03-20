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
        background: "#0b0f17",
        surface: "#131a24",
        border: "#2a3342",
        accent: "#ff5a47",
        "accent-dim": "#b63a2c",
        muted: "#7a879c",
        text: "#f3f6ff",
        "text-dim": "#b0bacb",
      },
    },
  },
  plugins: [],
};
export default config;