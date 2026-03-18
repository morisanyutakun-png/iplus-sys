"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

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

  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [isFocused, focusTrigger]);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      onKeyDown={(e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
        }
      }}
      className={cn(
        "h-8 w-full text-center text-sm rounded-md border bg-white transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white",
        isFocused
          ? "border-primary ring-2 ring-primary/30 shadow-sm"
          : "border-gray-200 hover:border-gray-300"
      )}
      placeholder="-"
      value={value ?? ""}
      onClick={onClick}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        if (raw === "") {
          onChange(null);
        } else {
          const num = Math.min(Math.max(0, parseInt(raw)), max);
          onChange(num);
        }
      }}
    />
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
