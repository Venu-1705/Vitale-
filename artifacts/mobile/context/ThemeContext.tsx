import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextType = {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  preference: "system",
  resolvedTheme: "light",
  setPreference: () => {},
});

const STORAGE_KEY = "vitale_theme_v1";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") {
          setPreferenceState(v);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const resolvedTheme: "light" | "dark" =
    preference === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : preference;

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
