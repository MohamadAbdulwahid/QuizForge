import daisyui from 'daisyui';

export default {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'bubbly-background': '#f9fafb',
        'bubbly-primary': '#00a5e0',
        'bubbly-accent': '#cd2750',
      },
      fontFamily: {
        display: ['DynaPuff', 'cursive'],
        body: ['Nunito', 'sans-serif'],
      },
      boxShadow: {
        tactile: '0 6px 0 0 rgba(7, 15, 24, 0.18)',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    logs: false,
    themes: [
      {
        bubbly: {
          primary: '#00a5e0',
          secondary: '#93c1eb',
          accent: '#cd2750',
          neutral: '#14416c',
          'base-100': '#f9fafb',
          'base-200': '#eaf1f8',
          'base-content': '#070f18',
          info: '#3abff8',
          success: '#36d399',
          warning: '#fbbd23',
          error: '#f87272',
        },
      },
    ],
  },
};
