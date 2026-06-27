/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // GitHub-style contribution heatmap scale
        heat: {
          0: '#161b22',
          1: '#0e4429',
          2: '#006d32',
          3: '#26a641',
          4: '#39d353',
        },
      },
    },
  },
  plugins: [],
}
