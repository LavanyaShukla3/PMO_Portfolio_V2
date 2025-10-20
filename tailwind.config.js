/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'status-red': '#ef4444',
        'status-amber': '#f59e0b',
        'status-green': '#10b981',
        'status-grey': '#9ca3af',
      },
    },
  },
  plugins: [],
  // Performance optimizations
  safelist: [], // Explicitly empty if no dynamic classes
  // Performance optimization for development
  future: {
    hoverOnlyWhenSupported: true,
  },
  // Reduce CSS file size
  corePlugins: {
    preflight: true,
  }
}