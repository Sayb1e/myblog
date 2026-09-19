import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePref = "dark" | "light" | "system";
export type StylePref = "native" | "product";

export interface Prefs {
  theme: ThemePref;
  style: StylePref;
  chatEnabled: boolean;
  terminalEnabled: boolean;
  liveRefresh: boolean;
  animations: boolean;
  codeHighlight: boolean;
  compact: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  theme: "system",
  style: "product",
  chatEnabled: true,
  terminalEnabled: true,
  liveRefresh: true,
  animations: true,
  codeHighlight: true,
  compact: false,
};

const STORAGE_KEY = "myblog:prefs";

interface PrefsContextValue {
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
}

const PrefsContext = createContext<PrefsContextValue>({ prefs: DEFAULT_PREFS, setPref: () => {} });

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function resolveTheme(theme: ThemePref): "dark" | "light" {
  if (theme !== "system") return theme;
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyAppearance(theme: ThemePref, style: StylePref): void {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.dataset.theme = resolved;
  root.dataset.style = style;
  root.style.colorScheme = resolved;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((current) => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage unavailable
    }
    applyAppearance(prefs.theme, prefs.style);
    document.body.classList.toggle("no-anim", !prefs.animations);
    document.body.classList.toggle("compact", prefs.compact);
  }, [prefs]);

  useEffect(() => {
    if (prefs.theme !== "system") return;
    let media: MediaQueryList;
    try {
      media = window.matchMedia("(prefers-color-scheme: light)");
    } catch {
      return;
    }
    const onChange = (): void => applyAppearance("system", prefs.style);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [prefs.theme, prefs.style]);

  const value = useMemo(() => ({ prefs, setPref }), [prefs, setPref]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  return useContext(PrefsContext);
}

export function useResolvedTheme(): "dark" | "light" {
  const { prefs } = usePrefs();
  const [resolved, setResolved] = useState(() => resolveTheme(prefs.theme));

  useEffect(() => {
    setResolved(resolveTheme(prefs.theme));
    if (prefs.theme !== "system") return;
    let media: MediaQueryList;
    try {
      media = window.matchMedia("(prefers-color-scheme: light)");
    } catch {
      return;
    }
    const onChange = (): void => setResolved(resolveTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [prefs.theme]);

  return resolved;
}
