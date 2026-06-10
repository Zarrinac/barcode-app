import type { Config } from 'tailwindcss';

// Tailwind v4 config enabling class-based and data-attribute dark mode toggles.
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
};

export default config;
