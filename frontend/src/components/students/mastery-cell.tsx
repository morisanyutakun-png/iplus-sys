"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/** 全角数字・ピリオドを半角に変換 */
function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/．/g, ".");
}

/** 半角数字と小数点のみ許可 */
const VALID_PATTERN = /^[0-9]*\.?[0-9]*$/;

type ScoreCellProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  isFocused: boolean;
  focusTrigger?: number;
  max?: number;
  onClick?: () => void;
};

export function ScoreCell({
  value,
  onChange,
  isFocused,
  focusTrigger,
  max = 9999,
  onClick,
}: ScoreCellProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState(value !== null ? String(value) : "");
  const [showWarning, setShowWarning] = useState(false);
  const warningTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync rawText when value changes externally (e.g. reset)
  useEffect(() => {
    setRawText(value !== null ? String(value) : "");
  }, [value]);

  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [isFocused, focusTrigger]);

  const triggerWarning = useCallback(() => {
    setShowWarning(true);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    warningTimer.current = setTimeout(() => setShowWarning(false), 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
  }, []);

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        onKeyDown={(e) => {
          // IME変換中は矢印キーブロックしない（候補選択に使う）
          if (e.isComposing || e.keyCode === 229) return;
          if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
          }
        }}
        className={cn(
          "h-8 w-full text-center text-sm rounded-md border bg-white transition-all",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white",
          showWarning
            ? "border-red-400 ring-2 ring-red-300/50 bg-red-50"
            : isFocused
            ? "border-primary ring-2 ring-primary/30 shadow-sm"
            : "border-gray-200 hover:border-gray-300"
        )}
        placeholder="-"
        value={rawText}
        onClick={onClick}
        onChange={(e) => {
          // Step 1: 全角→半角変換
          const converted = toHalfWidth(e.target.value);

          // Step 2: バリデーション
          if (!VALID_PATTERN.test(converted)) {
            triggerWarning();
            return;
          }

          setShowWarning(false);
          setRawText(converted);

          // Step 3: 数値変換
          if (converted === "" || converted === ".") {
            onChange(null);
          } else {
            const num = parseFloat(converted);
            if (!isNaN(num)) {
              onChange(Math.min(Math.max(0, num), max));
            }
          }
        }}
        onBlur={() => {
          // On blur, normalize display (remove trailing dot, etc.)
          if (value !== null) {
            setRawText(String(value));
          } else {
            setRawText("");
          }
        }}
      />
      {showWarning && (
        <span className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-red-500 font-medium whitespace-nowrap">
          半角数字のみ
        </span>
      )}
    </div>
  );
}

type PassCheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  isFocused: boolean;
  focusTrigger?: number;
};

export function PassCheckbox({
  checked,
  onToggle,
  isFocused,
  focusTrigger,
}: PassCheckboxProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused) ref.current?.focus();
  }, [isFocused, focusTrigger]);

  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md border-2 transition-all cursor-pointer mx-auto",
        "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/40",
        checked
          ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
          : "bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50"
      )}
      onClick={onToggle}
      tabIndex={-1}
    >
      {checked && <Check className="h-4 w-4" strokeWidth={3} />}
    </button>
  );
}
