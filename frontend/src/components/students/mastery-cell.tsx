"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type ScoreCellProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  isFocused: boolean;
  max?: number;
};

export function ScoreCell({
  value,
  onChange,
  isFocused,
  max = 9999,
}: ScoreCellProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused) ref.current?.focus();
  }, [isFocused]);

  return (
    <input
      ref={ref}
      type="number"
      min={0}
      max={max}
      className={cn(
        "h-8 w-full text-center text-sm rounded border bg-white transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        isFocused ? "border-primary ring-2 ring-primary/20" : "border-border"
      )}
      placeholder="-"
      value={value ?? ""}
      onChange={(e) => {
        const val =
          e.target.value === ""
            ? null
            : Math.max(0, parseInt(e.target.value) || 0);
        onChange(val);
      }}
    />
  );
}

type PassCheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  isFocused: boolean;
};

export function PassCheckbox({
  checked,
  onToggle,
  isFocused,
}: PassCheckboxProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused) ref.current?.focus();
  }, [isFocused]);

  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded border-2 transition-all cursor-pointer mx-auto",
        "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/40",
        checked
          ? "bg-emerald-600 border-emerald-600 text-white"
          : "bg-white border-gray-300 hover:border-gray-400"
      )}
      onClick={onToggle}
      tabIndex={-1}
    >
      {checked && <Check className="h-4 w-4" strokeWidth={3} />}
    </button>
  );
}
