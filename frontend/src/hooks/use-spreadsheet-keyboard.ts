import { useCallback, useEffect, useState } from "react";

type CellCoord = { col: number; row: number };

// Editable rows: 0=score, 1=maxScore, 2=pass checkbox
const EDITABLE_ROWS = 3;

type Options = {
  colCount: number;
  onTogglePass: (col: number) => void;
  onSave: () => void;
  onEscape: () => void;
  enabled?: boolean;
};

export function useSpreadsheetKeyboard({
  colCount,
  onTogglePass,
  onSave,
  onEscape,
  enabled = true,
}: Options) {
  const [activeCell, setActiveCell] = useState<CellCoord>({ col: 0, row: 0 });

  // Keep activeCell in bounds
  useEffect(() => {
    if (colCount > 0 && activeCell.col >= colCount) {
      setActiveCell((prev) => ({ ...prev, col: Math.max(0, colCount - 1) }));
    }
  }, [colCount, activeCell.col]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || colCount === 0) return;

      // Ctrl+S / Cmd+S to save
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave();
        return;
      }

      // Don't intercept when a number input is focused (let it handle typing)
      const isInputFocused =
        document.activeElement?.tagName === "INPUT" &&
        (document.activeElement as HTMLInputElement).type === "number";

      if (isInputFocused) {
        if (e.key === "Escape") {
          e.preventDefault();
          (document.activeElement as HTMLElement).blur();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          // Tab moves to next editable row, or next column
          const nextRow = e.shiftKey ? activeCell.row - 1 : activeCell.row + 1;
          if (nextRow < 0) {
            // Move to prev column, last row
            setActiveCell({
              col: Math.max(0, activeCell.col - 1),
              row: EDITABLE_ROWS - 1,
            });
          } else if (nextRow >= EDITABLE_ROWS) {
            // Move to next column, first row
            setActiveCell({
              col: Math.min(colCount - 1, activeCell.col + 1),
              row: 0,
            });
          } else {
            setActiveCell((prev) => ({ ...prev, row: nextRow }));
          }
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          // Move down within same column
          const nextRow = Math.min(EDITABLE_ROWS - 1, activeCell.row + 1);
          setActiveCell((prev) => ({ ...prev, row: nextRow }));
          return;
        }
        return;
      }

      switch (e.key) {
        case "ArrowLeft": {
          e.preventDefault();
          setActiveCell((prev) => ({
            ...prev,
            col: Math.max(0, prev.col - 1),
          }));
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          setActiveCell((prev) => ({
            ...prev,
            col: Math.min(colCount - 1, prev.col + 1),
          }));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setActiveCell((prev) => ({
            ...prev,
            row: Math.max(0, prev.row - 1),
          }));
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          setActiveCell((prev) => ({
            ...prev,
            row: Math.min(EDITABLE_ROWS - 1, prev.row + 1),
          }));
          break;
        }
        case "Tab": {
          e.preventDefault();
          const nextRow = e.shiftKey ? activeCell.row - 1 : activeCell.row + 1;
          if (nextRow < 0) {
            setActiveCell({
              col: Math.max(0, activeCell.col - 1),
              row: EDITABLE_ROWS - 1,
            });
          } else if (nextRow >= EDITABLE_ROWS) {
            setActiveCell({
              col: Math.min(colCount - 1, activeCell.col + 1),
              row: 0,
            });
          } else {
            setActiveCell((prev) => ({ ...prev, row: nextRow }));
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          // If on pass checkbox row (row 2), toggle
          if (activeCell.row === 2) {
            onTogglePass(activeCell.col);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          onEscape();
          break;
        }
      }
    },
    [enabled, colCount, activeCell, onTogglePass, onSave, onEscape]
  );

  return {
    activeCell,
    setActiveCell,
    handleKeyDown,
  };
}
