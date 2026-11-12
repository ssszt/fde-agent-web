/** @type {import('tailwindcss').Config} */
export default {
  darkMode: [
    'variant',
    [
      '@media (prefers-color-scheme: dark) { :where(html:not(:has(> head > meta[name="color-scheme"][content="light"]))) & }',
      ':where(html:has(> head > meta[name="color-scheme"][content="dark"])) &'
    ]
  ],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}

