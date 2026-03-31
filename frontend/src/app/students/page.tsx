"use client";

import { Suspense, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useStudents } from "@/lib/queries/students";
import { StudentDetailPanel } from "@/components/students/student-detail-panel";
import { Users } from "lucide-react";
import { StudentCreateDialog } from "@/components/students/student-create-dialog";

function StudentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: students, isLoading } = useStudents();

  const [focusZone, setFocusZone] = useState<"list" | "spreadsheet">("list");
  const hasPendingRef = useRef(false);

  const handlePendingChange = useCallback((hasPending: boolean) => {
    hasPendingRef.current = hasPending;
  }, []);

  const selectedStudentId = searchParams.get("student");
  const activeTab = searchParams.get("tab") || "mastery";
  const instructorId = searchParams.get("instructor");

  const selectedStudent = useMemo(
    () => students?.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  // Persist URL params to sessionStorage so sidebar can restore them
  useEffect(() => {
    const params = searchParams.toString();
    if (params) {
      sessionStorage.setItem("students_params", params);
    }
  }, [searchParams]);

  // Helper to update URL params without losing others
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      const paramStr = params.toString();
      // Immediately persist to sessionStorage so sidebar picks it up
      if (paramStr) sessionStorage.setItem("students_params", paramStr);
      router.replace(`/students?${paramStr}`);
    },
    [searchParams, router]
  );

  const handleSelectStudent = useCallback(
    (studentId: string) => {
      if (hasPendingRef.current && studentId !== selectedStudentId) {
        if (!window.confirm("未反映の入力があります。破棄してよろしいですか？")) {
          return;
        }
      }
      updateParams({ student: studentId });
    },
    [updateParams, selectedStudentId]
  );

  const handleTabChange = useCallback(
    (tab: string) => {
      updateParams({ tab });
    },
    [updateParams]
  );

  const handleInstructorChange = useCallback(
    (id: number | null) => {
      updateParams({ instructor: id !== null ? String(id) : null });
    },
    [updateParams]
  );

  const handleEnterSpreadsheet = useCallback(() => {
    setFocusZone("spreadsheet");
  }, []);

  const handleEscapeSpreadsheet = useCallback(() => {
    setFocusZone("list");
  }, []);

  // Auto-select first student if none selected
  useEffect(() => {
    if (!selectedStudentId && students && students.length > 0) {
      updateParams({ student: students[0].id, tab: "mastery" });
    }
  }, [selectedStudentId, students, updateParams]);

  // Show loading or empty state while students load / auto-select
  if (!selectedStudent) {
    if (isLoading) {
      return <div className="flex h-64 items-center justify-center text-muted-foreground">読み込み中...</div>;
    }
    if (!students || students.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="h-10 w-10 opacity-20 mb-3" />
          <p className="text-sm mb-4">生徒が登録されていません</p>
          <StudentCreateDialog />
        </div>
      );
    }
    return null; // auto-select will fire
  }

  return (
    <div className="space-y-4">
      <StudentDetailPanel
        studentId={selectedStudent.id}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        instructorId={instructorId ? Number(instructorId) : null}
        onInstructorChange={handleInstructorChange}
        students={students || []}
        onSelectStudent={handleSelectStudent}
        spreadsheetActive={focusZone === "spreadsheet"}
        onEnterSpreadsheet={handleEnterSpreadsheet}
        onEscapeSpreadsheet={handleEscapeSpreadsheet}
        onPendingChange={handlePendingChange}
      />
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
