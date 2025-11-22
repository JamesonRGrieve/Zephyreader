"use client";

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, systemTheme, setTheme } = useTheme();
  const resolvedTheme = theme === 'system' ? systemTheme : theme;
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <Button variant='outline' size='icon' onClick={() => setTheme(nextTheme ?? 'light')} aria-label='Toggle theme'>
      <Sun className='h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
      <Moon className='absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
      <span className='sr-only'>Toggle theme</span>
    </Button>
  );
}

