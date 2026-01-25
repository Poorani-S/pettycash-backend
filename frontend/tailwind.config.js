/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#E3F2FD",
          DEFAULT: "#0077b6",
          dark: "#023e8a",
        },
        accent: {
          light: "#B8E0F6",
          DEFAULT: "#0077b6",
          dark: "#023e8a",
        },
        background: {
          DEFAULT: "#F8FAFB",
          white: "#FFFFFF",
        },
        secondary: "#10B981",
        danger: "#EF4444",
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 119, 182, 0.15), 0 4px 6px -2px rgba(2, 62, 138, 0.1)",
        hover:
          "0 10px 40px -3px rgba(0, 119, 182, 0.25), 0 4px 6px -2px rgba(2, 62, 138, 0.15)",
      },
    },
  },
  plugins: [],
};
