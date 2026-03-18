"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useStudents } from "@/lib/queries/students";
import { StudentDetailPanel } from "@/components/students/student-detail-panel";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function StudentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: students, isLoading } = useStudents();

  const [open, setOpen] = useState(false);
  const [focusZone, setFocusZone] = useState<"list" | "spreadsheet">("list");

  const selectedStudentId = searchParams.get("student");

  const selectedStudent = useMemo(
    () => students?.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  const handleSelectStudent = useCallback(
    (studentId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("student", studentId);
      router.replace(`/students?${params.toString()}`);
      setOpen(false);
    },
    [searchParams, router]
  );

  const handleEnterSpreadsheet = useCallback(() => {
    setFocusZone("spreadsheet");
  }, []);

  const handleEscapeSpreadsheet = useCallback(() => {
    setFocusZone("list");
  }, []);

  return (
    <div className="space-y-4">
      {/* Student selector bar */}
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-primary shrink-0" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[320px] justify-between"
            >
              {selectedStudent ? (
                <span className="truncate">{selectedStudent.name}</span>
              ) : (
                <span className="text-muted-foreground">生徒を検索・選択...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="名前で検索..." />
              <CommandList>
                <CommandEmpty>該当なし</CommandEmpty>
                <CommandGroup>
                  {isLoading ? (
                    <CommandItem disabled>読み込み中...</CommandItem>
                  ) : (
                    (students || []).map((student) => {
                      const avgPercent =
                        student.materials.length > 0
                          ? Math.round(
                              student.materials.reduce(
                                (a, m) => a + m.percent,
                                0
                              ) / student.materials.length
                            )
                          : 0;
                      return (
                        <CommandItem
                          key={student.id}
                          value={`${student.name} ${student.id}`}
                          onSelect={() => handleSelectStudent(student.id)}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                student.id === selectedStudentId
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <span className="truncate">{student.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {student.materials.length}教材
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              {avgPercent}%
                            </Badge>
                          </div>
                        </CommandItem>
                      );
                    })
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedStudent && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{selectedStudent.materials.length}教材</span>
            <span>·</span>
            <span>
              平均進捗{" "}
              {selectedStudent.materials.length > 0
                ? Math.round(
                    selectedStudent.materials.reduce(
                      (a, m) => a + m.percent,
                      0
                    ) / selectedStudent.materials.length
                  )
                : 0}
              %
            </span>
          </div>
        )}
      </div>

      {/* Detail content */}
      {selectedStudentId ? (
        <StudentDetailPanel
          studentId={selectedStudentId}
          spreadsheetActive={focusZone === "spreadsheet"}
          onEscapeSpreadsheet={handleEscapeSpreadsheet}
        />
      ) : (
        <div className="flex h-[60vh] flex-col items-center justify-center text-muted-foreground">
          <Users className="h-10 w-10 opacity-20 mb-4" />
          <p className="text-sm">上の検索から生徒を選択してください</p>
        </div>
      )}
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          読み込み中...
        </div>
      }
    >
      <StudentsContent />
    </Suspense>
  );
}
