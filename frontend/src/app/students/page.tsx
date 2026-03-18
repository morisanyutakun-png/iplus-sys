"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StudentListPanel } from "@/components/students/student-list-panel";
import { StudentDetailPanel } from "@/components/students/student-detail-panel";
import { Users, ClipboardCheck } from "lucide-react";

type FocusZone = "list" | "spreadsheet";

function StudentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [focusZone, setFocusZone] = useState<FocusZone>("list");

  const selectedStudentId = searchParams.get("student");

  const handleSelectStudent = useCallback(
    (studentId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("student", studentId);
      router.replace(`/students?${params.toString()}`);
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
    <div className="-mx-8 -my-8 flex h-[calc(100vh-0px)]">
      {/* Left: Student list panel */}
      <StudentListPanel
        selectedStudentId={selectedStudentId}
        onSelectStudent={handleSelectStudent}
        onEnterSpreadsheet={handleEnterSpreadsheet}
        active={focusZone === "list"}
      />

      {/* Right: Detail panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedStudentId ? (
          <StudentDetailPanel
            studentId={selectedStudentId}
            spreadsheetActive={focusZone === "spreadsheet"}
            onEscapeSpreadsheet={handleEscapeSpreadsheet}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-10 w-10 opacity-20" />
              <ClipboardCheck className="h-10 w-10 opacity-20" />
            </div>
            <p className="text-sm">左のリストから生徒を選択してください</p>
            <p className="text-xs mt-1 text-muted-foreground/60">
              ↑↓キーで移動 · Enter で選択 · / で検索
            </p>
          </div>
        )}
      </div>
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
