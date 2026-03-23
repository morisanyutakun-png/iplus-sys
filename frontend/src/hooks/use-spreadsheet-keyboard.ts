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
  const [focusTrigger, setFocusTrigger] = useState(0);

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

      // IME変換中はスプレッドシートのキー操作を無効にする
      if (e.isComposing || e.keyCode === 229) return;

      // Ctrl+S / Cmd+S to save
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave();
        return;
      }

      // Arrow keys: ALWAYS move between cells (even when input/button is focused)
      const arrowMap: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      if (e.key in arrowMap) {
        e.preventDefault();
        const el = document.activeElement as HTMLElement;
        if (el?.tagName === "INPUT" || el?.tagName === "BUTTON") el.blur();
        const [dc, dr] = arrowMap[e.key];
        moveCell(dc, dr);
        setFocusTrigger((prev) => prev + 1);
        return;
      }

      const isTextInput =
        document.activeElement?.tagName === "INPUT" &&
        (document.activeElement as HTMLInputElement).type === "text";

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
          setFocusTrigger((prev) => prev + 1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
          moveCell(0, 1);
          setFocusTrigger((prev) => prev + 1);
          return;
        }
        return;
      }

      // No input focused — handle all navigation
      switch (e.key) {
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
    focusTrigger,
  };
}
