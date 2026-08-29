/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#FCFBF8",
          100: "#F5F2EA", // Main background
          200: "#EAE2D1", // Card background
          300: "#D8CBB0", // Borders
          400: "#C3B191", // Deeper borders
          500: "#AA936D", // Muted text
        },
        ink: {
          950: "#131416",
          900: "#1F2227",
          800: "#2D323A",
          700: "#424955",
          600: "#5A6270",
          500: "#747C8B",
          400: "#9198A6",
          300: "#B0B5C0",
        },
        crimson: {
          900: "#501219",
          800: "#6A1A22",
          700: "#8B222D",
          600: "#A52A36",
          500: "#C43343",
        },
        gold: {
          300: "#f5d77f",
          400: "#e9be4f",
          500: "#d4af37", // True illumination
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
      boxShadow: {
        'paper': '0 2px 8px -2px rgba(31, 34, 39, 0.05), 0 4px 16px -4px rgba(31, 34, 39, 0.02)',
        'paper-lg': '0 4px 16px -4px rgba(31, 34, 39, 0.08), 0 8px 32px -8px rgba(31, 34, 39, 0.04)',
        'glow-crimson': '0 0 16px rgba(106, 26, 34, 0.25)',
      },
    },
  },
  plugins: [],
};
