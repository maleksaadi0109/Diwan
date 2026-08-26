/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: "#0b0d10",
          900: "#111419",
          850: "#161a22",
          800: "#1c212b",
          700: "#272e3c",
          600: "#363f52",
        },
        parchment: {
          50: "#fdfbf7",
          100: "#f7f3ea",
          200: "#eee4d0",
          300: "#dfcfb0",
          400: "#c7b189",
          DEFAULT: "#f7f3ea",
        },
        gold: {
          300: "#f5d77f",
          400: "#e9be4f",
          500: "#d4af37", // Classic gold
          600: "#b89326",
          700: "#8c6e17",
        },
      },
      fontFamily: {
        poetry: ["'Amiri'", "'Scheherazade New'", "'Traditional Arabic'", "serif"],
        sans: ["'Cairo'", "'Almarai'", "'Segoe UI'", "Tahoma", "sans-serif"],
      },
      minWidth: {
        "app": "900px",
      },
      minHeight: {
        "app": "600px",
      },
    },
  },
  plugins: [],
};
