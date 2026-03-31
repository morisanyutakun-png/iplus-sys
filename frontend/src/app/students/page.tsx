"use client";

import { Suspense, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useStudents } from "@/lib/queries/students";
import { StudentDetailPanel } from "@/components/students/student-detail-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Search, UserPlus, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudentCreateDialog } from "@/components/students/student-create-dialog";

const AVATAR_COLORS = [
  "from-rose-500 to-red-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-teal-600",
];

function nameToColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function StudentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: students, isLoading } = useStudents();

  const [searchQuery, setSearchQuery] = useState("");
  const [focusZone, setFocusZone] = useState<"list" | "spreadsheet">("list");
  const hasPendingRef = useRef(false);

  const handlePendingChange = useCallback((hasPending: boolean) => {
    hasPendingRef.current = hasPending;
  }, []);

  const selectedStudentId = searchParams.get("student");
  const initialTab = searchParams.get("tab") || "mastery";

  const selectedStudent = useMemo(
    () => students?.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const handleSelectStudent = useCallback(
    (studentId: string) => {
      if (hasPendingRef.current && studentId !== selectedStudentId) {
        if (!window.confirm("未反映の入力があります。破棄してよろしいですか？")) {
          return;
        }
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("student", studentId);
      router.replace(`/students?${params.toString()}`);
    },
    [searchParams, router, selectedStudentId]
  );

  const handleBack = useCallback(() => {
    if (hasPendingRef.current) {
      if (!window.confirm("未反映の入力があります。破棄してよろしいですか？")) {
        return;
      }
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("student");
    params.delete("tab");
    router.replace(`/students?${params.toString()}`);
  }, [searchParams, router]);

  const handleEnterSpreadsheet = useCallback(() => {
    setFocusZone("spreadsheet");
  }, []);

  const handleEscapeSpreadsheet = useCallback(() => {
    setFocusZone("list");
  }, []);

  // When a student is selected, show detail panel
  if (selectedStudentId) {
    return (
      <div className="space-y-4">
        {/* Header with back button */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            生徒一覧
          </Button>
          {selectedStudent && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0 flex-1">
              <span className="font-medium text-foreground truncate">{selectedStudent.name}</span>
              <span className="shrink-0">·</span>
              <span className="shrink-0">{selectedStudent.materials.length}教材</span>
              <span className="shrink-0">·</span>
              <span className="shrink-0">
                平均進捗{" "}
                {selectedStudent.materials.length > 0
                  ? Math.round(
                      selectedStudent.materials.reduce((a, m) => a + m.percent, 0) /
                        selectedStudent.materials.length
                    )
                  : 0}
                %
              </span>
            </div>
          )}
          <div className="ml-auto shrink-0">
            <StudentCreateDialog />
          </div>
        </div>

        <StudentDetailPanel
          studentId={selectedStudentId}
          initialTab={initialTab}
          spreadsheetActive={focusZone === "spreadsheet"}
          onEnterSpreadsheet={handleEnterSpreadsheet}
          onEscapeSpreadsheet={handleEscapeSpreadsheet}
          onPendingChange={handlePendingChange}
        />
      </div>
    );
  }

  // Student selection view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">生徒</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {students ? `${students.length}名の生徒` : "読み込み中..."}
          </p>
        </div>
        <div className="shrink-0">
          <StudentCreateDialog />
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="名前またはIDで検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Student cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-2xl skeleton-pulse" />
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="h-10 w-10 opacity-20 mb-3" />
          <p className="text-sm">
            {searchQuery ? "該当する生徒が見つかりません" : "生徒が登録されていません"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const avgPercent =
              student.materials.length > 0
                ? Math.round(
                    student.materials.reduce((a, m) => a + m.percent, 0) /
                      student.materials.length
                  )
                : 0;
            return (
              <Card
                key={student.id}
                className="border-0 shadow-premium overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                onClick={() => handleSelectStudent(student.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white text-base font-bold shadow-sm",
                        nameToColor(student.name)
                      )}
                    >
                      {student.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold truncate">{student.name}</span>
                        {student.grade && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {student.grade}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {student.materials.length}教材
                        </span>
                        {student.materials.length > 0 && (
                          <Badge
                            variant={avgPercent >= 75 ? "default" : avgPercent >= 40 ? "secondary" : "outline"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            進捗 {avgPercent}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
