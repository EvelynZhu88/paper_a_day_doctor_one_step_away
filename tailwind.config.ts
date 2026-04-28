import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#fafaf9",
        card: "#ffffff",
        ink: "#1c1917",
        muted: "#78716c",
        accent: "#dc2626",
      },
    },
  },
  plugins: [],
}

export default config
