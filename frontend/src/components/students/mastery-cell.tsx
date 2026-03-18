"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ScoreCellProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  isFocused: boolean;
};

export function ScoreCell({ value, onChange, isFocused }: ScoreCellProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused) ref.current?.focus();
  }, [isFocused]);

  return (
    <input
      ref={ref}
      type="number"
      min={0}
      max={100}
      className={cn(
        "h-8 w-16 text-center text-sm rounded border bg-white transition-all",
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
            : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
        onChange(val);
      }}
    />
  );
}

type StatusCellProps = {
  value: "completed" | "retry" | null;
  onToggle: () => void;
  isFocused: boolean;
};

export function StatusCell({ value, onToggle, isFocused }: StatusCellProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused) ref.current?.focus();
  }, [isFocused]);

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "h-8 w-14 rounded-md text-sm font-bold transition-all cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-offset-1",
        value === "completed"
          ? "bg-red-600 text-white focus:ring-red-400"
          : value === "retry"
          ? "bg-gray-800 text-white focus:ring-gray-500"
          : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200 focus:ring-gray-300",
        isFocused && "ring-2 ring-offset-1"
      )}
      onClick={onToggle}
      tabIndex={-1}
    >
      {value === "completed" ? "○" : value === "retry" ? "×" : "—"}
    </button>
  );
}
