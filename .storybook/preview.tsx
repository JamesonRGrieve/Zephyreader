import type { Decorator, Preview } from '@storybook/react';
import { ThemeProvider } from '@/components/theme-provider';
import '../app/globals.css';

const withTheme: Decorator = (Story) => (
  <ThemeProvider attribute='class' defaultTheme='light' enableSystem disableTransitionOnChange>
    <div className='min-h-screen bg-background text-foreground p-6'>
      <Story />
    </div>
  </ThemeProvider>
);

const preview: Preview = {
  decorators: [withTheme],
  parameters: {
    actions: { argTypesRegex: '^on.*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },
};

export default preview;
