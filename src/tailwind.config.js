/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    'bg-orange-500',
    'border-orange-600',
    'text-orange-700',
    'text-orange-600',
    'bg-purple-500',
    'border-purple-600',
    'text-purple-700',
    'text-purple-600',
    'text-red-500',
    'border-red-400',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}