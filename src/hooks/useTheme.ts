import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

export function useTheme() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return { theme, toggleTheme, setTheme };
}
