import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
content: ['./index.html', './src/**/*.{ts,tsx}'],
theme: {
extend: {
colors: {
forest: '#1E472A',
lime: '#88C540',
charcoal: '#2D2D2D',
cream: '#FAF8F5',
warm: '#F2EFE9',
dashboard: '#111613',
sidebar: '#0A0F0C',
card: '#141D18',
line: '#223028',
},
fontFamily: {
display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
},
boxShadow: {
soft: '0 24px 80px rgba(30, 71, 42, .10)',
editorial: '0 26px 70px -22px rgba(30, 71, 42, .16)',
},
borderRadius: {
organic: '2rem 2rem 2rem .5rem',
},
},
},
plugins: [forms],
} satisfies Config;
