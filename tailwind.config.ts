import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F8F6FF',
          100: '#F3F0FF',
          200: '#E9D5FF',
          300: '#DDD6FE',
          400: '#C4B5FD',
          500: '#A78BFA',
          600: '#8B5CF6',
          700: '#7C3AED',
          800: '#6D28D9',
          900: '#5B21B6',
        },
        purple: {
          50: '#F8F6FF',
          100: '#F3F0FF',
          200: '#E9D5FF',
          300: '#DDD6FE',
          400: '#C4B5FD',
          500: '#A78BFA',
          600: '#8B5CF6',
          700: '#7C3AED',
          800: '#6D28D9',
          900: '#5B21B6',
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;

