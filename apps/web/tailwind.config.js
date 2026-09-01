/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f6f8fa",
        surface: "#ffffff",
        "surface-2": "#f6f8fa",
        border: "#d0d7de",
        muted: "#656d76",
        accent: "#1f883d",
        link: "#0969da",
      },
    },
  },
  plugins: [],
};
