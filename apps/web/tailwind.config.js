/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0c0f14",
        surface: "#141820",
        "surface-2": "#1a2030",
        border: "#2a3344",
        muted: "#8b95a8",
        accent: "#6ee7b7",
        "accent-2": "#818cf8",
      },
    },
  },
  plugins: [],
};
