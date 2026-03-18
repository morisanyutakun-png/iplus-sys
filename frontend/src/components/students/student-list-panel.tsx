"use client";

import { useState, useCallback, useMemo } from "react";
import { useStudents } from "@/lib/queries/students";
import { useStudentListKeyboard } from "@/hooks/use-student-list-keyboard";
import { StudentCreateDialog } from "./student-create-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Users } from "lucide-react";

type Props = {
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string) => void;
  onEnterSpreadsheet: () => void;
  active: boolean;
};

export function StudentListPanel({
  selectedStudentId,
  onSelectStudent,
  onEnterSpreadsheet,
  active,
}: Props) {
  const { data: students, isLoading } = useStudents();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!students) return [];
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [students, search]);

  const handleSelect = useCallback(
    (index: number) => {
      const student = filtered[index];
      if (student) onSelectStudent(student.id);
    },
    [filtered, onSelectStudent]
  );

  const { focusedIndex, setFocusedIndex, containerRef, searchRef } =
    useStudentListKeyboard({
      itemCount: filtered.length,
      onSelect: handleSelect,
      onEnterSpreadsheet,
      enabled: active,
    });

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-card",
        active && "ring-2 ring-primary/20 ring-inset"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">生徒</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {students?.length ?? 0}名
        </Badge>
      </div>

      {/* Search */}
      <div className="relative px-3 py-2">
        <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          type="text"
          placeholder="検索 (/ or Ctrl+K)"
          className="h-8 pl-8 text-xs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setFocusedIndex(0);
          }}
        />
      </div>

      {/* Student list */}
      <div className="flex-1 overflow-y-auto px-2 py-1" role="listbox">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            読み込み中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            {search ? "該当なし" : "生徒がいません"}
          </div>
        ) : (
          filtered.map((student, index) => {
            const isSelected = student.id === selectedStudentId;
            const isFocused = index === focusedIndex;
            const avgPercent =
              student.materials.length > 0
                ? Math.round(
                    student.materials.reduce((a, m) => a + m.percent, 0) /
                      student.materials.length
                  )
                : 0;

            return (
              <div
                key={student.id}
                role="option"
                aria-selected={isSelected}
                data-student-item
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                  isFocused && !isSelected && "ring-2 ring-primary/40"
                )}
                onClick={() => {
                  onSelectStudent(student.id);
                  setFocusedIndex(index);
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{student.name}</div>
                  <div
                    className={cn(
                      "text-xs",
                      isSelected
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {student.materials.length}教材 · {avgPercent}%
                  </div>
                </div>
                {/* Mini progress indicator */}
                <div className="h-1.5 w-10 shrink-0 rounded-full bg-muted/50">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isSelected ? "bg-primary-foreground/60" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(avgPercent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: Add student */}
      <div className="border-t border-border p-3">
        <StudentCreateDialog />
      </div>
    </div>
  );
}
