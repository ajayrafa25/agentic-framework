/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f8f9fa",
        surface: "#ffffff",
        "surface-2": "#f4f5f7",
        sidebar: "#1a1a1a",
        border: "#e5e7eb",
        muted: "#6b7280",
        accent: "#f9c74f",
        link: "#277da1",
        loss: "#e63946",
        ok: "#2a9d8f",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};
