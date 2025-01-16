const defaultTheme = require('tailwindcss/defaultTheme')
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', //'media',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@availabs/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': [
          //'Proxima Nova',
          ...defaultTheme.fontFamily.sans
        ],
        'display': [
          'Oswald',
          ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}