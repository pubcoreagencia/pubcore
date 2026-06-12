import { useEffect, useState } from "react";

const GRATITUDE_KEY = "pubcore:gratitude-enabled";

export function isGratitudeEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(GRATITUDE_KEY);
  return v === null ? true : v === "true";
}

export function setGratitudeEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GRATITUDE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("pubcore:gratitude-pref-changed", { detail: enabled }));
}

export function useGratitudeEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => isGratitudeEnabled());
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setEnabled(typeof detail === "boolean" ? detail : isGratitudeEnabled());
    };
    window.addEventListener("pubcore:gratitude-pref-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("pubcore:gratitude-pref-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  const update = (v: boolean) => {
    setGratitudeEnabled(v);
    setEnabled(v);
  };
  return [enabled, update];
}
