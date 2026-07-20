import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        tairos: {
          bg: "var(--tairos-bg)",
          surface: "var(--tairos-surface)",
          card: "var(--tairos-card)",
          border: "var(--tairos-border)",
          "border-hover": "var(--tairos-border-hover)",
          accent: "rgb(var(--tairos-accent-rgb) / <alpha-value>)",
          cyan: "rgb(var(--tairos-cyan-rgb) / <alpha-value>)",
          green: "rgb(var(--tairos-green-rgb) / <alpha-value>)",
          red: "rgb(var(--tairos-red-rgb) / <alpha-value>)",
          amber: "rgb(var(--tairos-amber-rgb) / <alpha-value>)",
          text: "var(--tairos-text)",
          muted: "var(--tairos-muted)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "gradient-mesh": "var(--tairos-gradient-mesh)",
      },
      boxShadow: {
        glass: "var(--tairos-shadow-glass)",
        "glass-sm": "0 4px 16px rgba(0, 0, 0, 0.1)",
        neon: "0 0 20px rgba(139, 92, 246, 0.3)",
        "neon-cyan": "0 0 20px rgba(6, 182, 212, 0.3)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.5s ease-out",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(139, 92, 246, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(139, 92, 246, 0.4)" },
        },
        slideIn: {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
}

export default config
