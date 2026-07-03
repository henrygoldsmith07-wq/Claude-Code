import { useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { CATEGORIES } from "./categories";

export function useCategories() {
  const [customCategories, setCustomCategories] = useLocalStorage<string[]>(
    "customCategories",
    [],
  );

  const allCategories = useMemo(
    () => [...CATEGORIES, ...customCategories.filter((c) => !(CATEGORIES as readonly string[]).includes(c))],
    [customCategories],
  );

  function addCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed || allCategories.includes(trimmed)) return;
    setCustomCategories([...customCategories, trimmed]);
  }

  function removeCategory(name: string) {
    setCustomCategories(customCategories.filter((c) => c !== name));
  }

  return { allCategories, customCategories, addCategory, removeCategory };
}
