import { useCallback, useEffect, useState } from "react";

type CellCoord = { row: number; col: number };

// Editable columns: 0=score, 1=status
const EDITABLE_COLS = 2;

type Options = {
  rowCount: number;
  onToggleStatus: (row: number) => void;
  onSave: () => void;
  onEscape: () => void;
  enabled?: boolean;
};

export function useSpreadsheetKeyboard({
  rowCount,
  onToggleStatus,
  onSave,
  onEscape,
  enabled = true,
}: Options) {
  const [activeCell, setActiveCell] = useState<CellCoord>({ row: 0, col: 0 });

  // Keep activeCell in bounds
  useEffect(() => {
    if (rowCount > 0 && activeCell.row >= rowCount) {
      setActiveCell((prev) => ({ ...prev, row: Math.max(0, rowCount - 1) }));
    }
  }, [rowCount, activeCell.row]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || rowCount === 0) return;

      // Ctrl+S / Cmd+S to save
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave();
        return;
      }

      // Don't intercept when an input is focused (let it handle typing)
      const isInputFocused =
        document.activeElement?.tagName === "INPUT" &&
        (document.activeElement as HTMLInputElement).type === "number";

      if (isInputFocused) {
        // Only handle navigation keys when input is focused
        if (e.key === "Escape") {
          e.preventDefault();
          (document.activeElement as HTMLElement).blur();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const nextCol = e.shiftKey
            ? Math.max(0, activeCell.col - 1)
            : Math.min(EDITABLE_COLS - 1, activeCell.col + 1);
          setActiveCell((prev) => ({ ...prev, col: nextCol }));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          // Move to next row, same column
          const nextRow = Math.min(rowCount - 1, activeCell.row + 1);
          setActiveCell({ row: nextRow, col: activeCell.col });
          return;
        }
        return;
      }

      switch (e.key) {
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
            row: Math.min(rowCount - 1, prev.row + 1),
          }));
          break;
        }
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          const delta = e.key === "ArrowLeft" ? -1 : 1;
          setActiveCell((prev) => ({
            ...prev,
            col: Math.max(0, Math.min(EDITABLE_COLS - 1, prev.col + delta)),
          }));
          break;
        }
        case "Tab": {
          e.preventDefault();
          const nextCol = e.shiftKey
            ? activeCell.col - 1
            : activeCell.col + 1;
          if (nextCol < 0 || nextCol >= EDITABLE_COLS) {
            // Move to next/prev row
            const nextRow = e.shiftKey
              ? Math.max(0, activeCell.row - 1)
              : Math.min(rowCount - 1, activeCell.row + 1);
            setActiveCell({
              row: nextRow,
              col: e.shiftKey ? EDITABLE_COLS - 1 : 0,
            });
          } else {
            setActiveCell((prev) => ({ ...prev, col: nextCol }));
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          // If on status column (col 1), toggle
          if (activeCell.col === 1) {
            onToggleStatus(activeCell.row);
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
    [enabled, rowCount, activeCell, onToggleStatus, onSave, onEscape]
  );

  return {
    activeCell,
    setActiveCell,
    handleKeyDown,
  };
}
