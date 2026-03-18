import { useCallback, useEffect, useState } from "react";

type CellCoord = { col: number; row: number };

// Editable rows: 0=score, 1=maxScore, 2=pass checkbox
const EDITABLE_ROWS = 3;

type Options = {
  colCount: number;
  completedCols?: Set<number>;
  onTogglePass: (col: number) => void;
  onSave: () => void;
  onEscape: () => void;
  enabled?: boolean;
};

function nextEditableCol(
  current: number,
  direction: 1 | -1,
  colCount: number,
  completedCols?: Set<number>
): number {
  let next = current + direction;
  while (next >= 0 && next < colCount && completedCols?.has(next)) {
    next += direction;
  }
  return next >= 0 && next < colCount ? next : current;
}

export function useSpreadsheetKeyboard({
  colCount,
  completedCols,
  onTogglePass,
  onSave,
  onEscape,
  enabled = true,
}: Options) {
  const [activeCell, setActiveCell] = useState<CellCoord>({ col: 0, row: 0 });

  // Keep activeCell in bounds & skip completed cols on init
  useEffect(() => {
    if (colCount <= 0) return;
    setActiveCell((prev) => {
      let col = Math.min(prev.col, colCount - 1);
      // Skip to first non-completed column
      if (completedCols?.has(col)) {
        col = nextEditableCol(-1, 1, colCount, completedCols);
      }
      return { col, row: prev.row };
    });
  }, [colCount, completedCols]);

  const moveCell = useCallback(
    (dc: number, dr: number) => {
      setActiveCell((prev) => {
        let newRow = prev.row + dr;
        let newCol = prev.col;

        // Wrap: going below last row → next column, first row
        if (newRow >= EDITABLE_ROWS) {
          newCol = nextEditableCol(prev.col, 1, colCount, completedCols);
          newRow = 0;
        }
        // Wrap: going above first row → prev column, last row
        if (newRow < 0) {
          newCol = nextEditableCol(prev.col, -1, colCount, completedCols);
          newRow = EDITABLE_ROWS - 1;
        }

        if (dc !== 0) {
          newCol = nextEditableCol(prev.col, dc as 1 | -1, colCount, completedCols);
        }

        return { col: newCol, row: newRow };
      });
    },
    [colCount, completedCols]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || colCount === 0) return;

      // Ctrl+S / Cmd+S to save
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave();
        return;
      }

      const isTextInput =
        document.activeElement?.tagName === "INPUT" &&
        (document.activeElement as HTMLInputElement).type === "text";

      // Arrow Up/Down: ALWAYS move between rows (even when input is focused)
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (isTextInput) (document.activeElement as HTMLElement).blur();
        moveCell(0, -1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (isTextInput) (document.activeElement as HTMLElement).blur();
        moveCell(0, 1);
        return;
      }

      // When text input is focused, handle specific keys
      if (isTextInput) {
        const input = document.activeElement as HTMLInputElement;

        if (e.key === "Escape") {
          e.preventDefault();
          input.blur();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          input.blur();
          moveCell(0, e.shiftKey ? -1 : 1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
          moveCell(0, 1);
          return;
        }
        // ArrowLeft: move to prev column when cursor is at start
        if (e.key === "ArrowLeft" && input.selectionStart === 0 && input.selectionEnd === 0) {
          e.preventDefault();
          input.blur();
          moveCell(-1, 0);
          return;
        }
        // ArrowRight: move to next column when cursor is at end
        if (e.key === "ArrowRight" && input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
          e.preventDefault();
          input.blur();
          moveCell(1, 0);
          return;
        }
        return;
      }

      // No input focused — handle all navigation
      switch (e.key) {
        case "ArrowLeft": {
          e.preventDefault();
          moveCell(-1, 0);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          moveCell(1, 0);
          break;
        }
        case "Tab": {
          e.preventDefault();
          moveCell(0, e.shiftKey ? -1 : 1);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          if (activeCell.row === 2) {
            onTogglePass(activeCell.col);
            // After toggling pass, auto-advance to next column's score
            moveCell(1, 0);
            setActiveCell((prev) => ({ ...prev, row: 0 }));
          } else {
            // On score/maxScore row, Enter moves down
            moveCell(0, 1);
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
    [enabled, colCount, activeCell, onTogglePass, onSave, onEscape, moveCell]
  );

  return {
    activeCell,
    setActiveCell,
    handleKeyDown,
  };
}
