import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  itemCount: number;
  onSelect: (index: number) => void;
  onEnterSpreadsheet: () => void;
  enabled?: boolean;
};

export function useStudentListKeyboard({
  itemCount,
  onSelect,
  onEnterSpreadsheet,
  enabled = true,
}: Options) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keep focusedIndex in bounds
  useEffect(() => {
    if (itemCount > 0 && focusedIndex >= itemCount) {
      setFocusedIndex(Math.max(0, itemCount - 1));
    }
  }, [itemCount, focusedIndex]);

  const scrollToIndex = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const items = container.querySelectorAll("[data-student-item]");
    items[index]?.scrollIntoView({ block: "nearest" });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      // Ctrl+K or / to focus search
      if (e.key === "/" || (e.key === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // Don't handle if search input is focused (except arrow keys and enter)
      const isSearchFocused = document.activeElement === searchRef.current;
      if (isSearchFocused && !["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)) {
        return;
      }

      switch (e.key) {
        case "ArrowUp": {
          e.preventDefault();
          const next = Math.max(0, focusedIndex - 1);
          setFocusedIndex(next);
          onSelect(next);
          scrollToIndex(next);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const next = Math.min(itemCount - 1, focusedIndex + 1);
          setFocusedIndex(next);
          onSelect(next);
          scrollToIndex(next);
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (isSearchFocused) {
            searchRef.current?.blur();
          }
          onSelect(focusedIndex);
          onEnterSpreadsheet();
          break;
        }
        case "Escape": {
          if (isSearchFocused) {
            searchRef.current?.blur();
          }
          break;
        }
      }
    },
    [enabled, itemCount, focusedIndex, onSelect, onEnterSpreadsheet, scrollToIndex]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, enabled]);

  return {
    focusedIndex,
    setFocusedIndex,
    containerRef,
    searchRef,
  };
}
