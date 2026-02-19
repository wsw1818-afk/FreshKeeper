import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = '@freshkeeper_theme';

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  isDark: false,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
