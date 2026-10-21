import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSetting, setSetting } from '../db/library';
import { DEFAULT_ACCENT } from './colors';

interface ThemeValue {
  accent: string;
  setAccent: (hex: string) => void;
}

const ThemeContext = createContext<ThemeValue>({ accent: DEFAULT_ACCENT, setAccent: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);

  useEffect(() => {
    getSetting('accent')
      .then((v) => v && setAccentState(v))
      .catch(() => undefined);
  }, []);

  const setAccent = useCallback((hex: string) => {
    setAccentState(hex);
    setSetting('accent', hex).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ accent, setAccent }), [accent, setAccent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ThemeValue => useContext(ThemeContext);
