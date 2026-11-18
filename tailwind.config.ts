import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import colors from 'tailwindcss/colors';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
      },
      // Brand accent. The whole console's primary colour is expressed through
      // the `indigo-*` utility classes; remapping that palette to teal recolours
      // every button, link, active state and progress bar in one place to match
      // the sidebar's cyan→teal theme, without touching semantic reds, greens,
      // ambers or the blue status badges.
      colors: {
        indigo: colors.teal,
      },
    },
  },
  plugins: [],
};

export default config;
