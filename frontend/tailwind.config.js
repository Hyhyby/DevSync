/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          dark: '#2C2F33',
          darker: '#23272A',
          darkest: '#1E2124',
          blurple: '#5865F2',
          green: '#57F287',
          red: '#ED4245',
          yellow: '#FEE75C'
        }
      }
    },
  },
  plugins: [],
}
