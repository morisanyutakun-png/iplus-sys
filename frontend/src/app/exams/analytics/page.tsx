"use client";

import { useState } from "react";
import { useStudents } from "@/lib/queries/students";
import { useExamMaterials } from "@/lib/queries/exam-materials";
import { useStudentExamSummary } from "@/lib/queries/exam-scores";
import { useExamOverview } from "@/lib/queries/exam-analytics";
import { SubjectScoreChart } from "@/components/exams/subject-score-chart";
import { ScoreTrendChart } from "@/components/exams/score-trend-chart";
import { TargetComparisonChart } from "@/components/exams/target-comparison-chart";
import { CompressedScoreCalculator } from "@/components/exams/compressed-score-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, User, Users, GraduationCap } from "lucide-react";
import Link from "next/link";

export default function ExamAnalyticsPage() {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [selectedGrade, setSelectedGrade] = useState<string>("");

  const { data: students } = useStudents();
  const { data: allExams } = useExamMaterials();
  const { data: summary } = useStudentExamSummary(selectedStudentId, selectedExamId || undefined);
  const { data: overview } = useExamOverview(selectedExamId, selectedGrade || undefined);

  // Get unique grades
  const grades = Array.from(new Set((students || []).map((s) => s.grade).filter(Boolean))) as string[];

  // Latest attempt for subject chart
  const latestAttempt = summary?.attempts?.[summary.attempts.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/exams">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">試験分析</h1>
          <p className="text-sm text-muted-foreground">
            生徒別スコア・教室平均・圧縮点の分析
          </p>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">試験</label>
          <Select
            value={selectedExamId ? String(selectedExamId) : ""}
            onValueChange={(v) => setSelectedExamId(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="試験を選択" />
            </SelectTrigger>
            <SelectContent>
              {(allExams || []).map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">生徒</label>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="生徒を選択" />
            </SelectTrigger>
            <SelectContent>
              {(students || []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} {s.grade ? `(${s.grade})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">学年フィルタ</label>
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger>
              <SelectValue placeholder="全学年" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全学年</SelectItem>
              {grades.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedExamId ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">試験を選択してください</p>
        </div>
      ) : (
        <Tabs defaultValue="student">
          <TabsList>
            <TabsTrigger value="student">
              <User className="mr-1.5 h-4 w-4" />
              生徒別
            </TabsTrigger>
            <TabsTrigger value="class">
              <Users className="mr-1.5 h-4 w-4" />
              教室全体
            </TabsTrigger>
            <TabsTrigger value="compressed">
              <GraduationCap className="mr-1.5 h-4 w-4" />
              圧縮点
            </TabsTrigger>
          </TabsList>

          {/* Student Analytics Tab */}
          <TabsContent value="student" className="space-y-4">
            {selectedStudentId && summary ? (
              <>
                {/* Summary cards */}
                {latestAttempt && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card className="border-0 shadow-premium">
                      <CardContent className="pt-5 text-center">
                        <div className="text-2xl font-bold">
                          {latestAttempt.total_score}
                          <span className="text-sm text-muted-foreground font-normal">
                            /{latestAttempt.total_max}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">最新合計点</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-premium">
                      <CardContent className="pt-5 text-center">
                        <div className="text-2xl font-bold">
                          {latestAttempt.percentage}%
                        </div>
                        <p className="text-xs text-muted-foreground">最新得点率</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-premium">
                      <CardContent className="pt-5 text-center">
                        <div className="text-2xl font-bold">
                          {summary.attempts.length}
                        </div>
                        <p className="text-xs text-muted-foreground">実施回数</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Subject score chart */}
                {latestAttempt && (
                  <Card className="border-0 shadow-premium overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-sm">教科別得点率</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SubjectScoreChart
                        subjects={latestAttempt.subjects}
                        title={`${latestAttempt.attempt_date}`}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Target comparison */}
                {latestAttempt && latestAttempt.subjects.some((s) => s.target_score != null) && (
                  <Card className="border-0 shadow-premium overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-sm">目標点との差異</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <TargetComparisonChart subjects={latestAttempt.subjects} />
                    </CardContent>
                  </Card>
                )}

                {/* Score trend */}
                {summary.attempts.length > 1 && (
                  <Card className="border-0 shadow-premium overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-sm">得点率推移</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScoreTrendChart attempts={summary.attempts} />
                    </CardContent>
                  </Card>
                )}

                {/* Attempt history table */}
                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">実施履歴</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 text-muted-foreground">日付</th>
                            <th className="text-left py-2 px-2 text-muted-foreground">試験</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">合計</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">得点率</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.attempts.map((a, i) => (
                            <tr key={i} className="border-b hover:bg-muted/30">
                              <td className="py-2 px-2">{a.attempt_date}</td>
                              <td className="py-2 px-2">{a.exam_name}</td>
                              <td className="py-2 px-2 text-right tabular-nums">
                                {a.total_score}/{a.total_max}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <Badge
                                  variant={a.percentage >= 80 ? "default" : a.percentage >= 60 ? "secondary" : "destructive"}
                                  className="text-xs"
                                >
                                  {a.percentage}%
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                生徒を選択してください
              </div>
            )}
          </TabsContent>

          {/* Class Overview Tab */}
          <TabsContent value="class" className="space-y-4">
            {overview ? (
              <>
                {/* Class average */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="border-0 shadow-premium">
                    <CardContent className="pt-5 text-center">
                      <div className="text-2xl font-bold">
                        {overview.class_average_total}
                      </div>
                      <p className="text-xs text-muted-foreground">教室平均点</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-premium">
                    <CardContent className="pt-5 text-center">
                      <div className="text-2xl font-bold">
                        {overview.class_average_percentage}%
                      </div>
                      <p className="text-xs text-muted-foreground">教室平均得点率</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Rankings */}
                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">生徒ランキング</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {overview.rankings.map((r, i) => (
                        <div
                          key={r.student_id}
                          className="flex items-center gap-3 rounded-lg border px-3 py-2"
                        >
                          <span className="w-6 text-center font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm">{r.student_name}</span>
                            {r.grade && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                {r.grade}
                              </Badge>
                            )}
                          </div>
                          <span className="tabular-nums text-sm">
                            {r.total_score}/{r.total_max}
                          </span>
                          <Badge
                            variant={r.percentage >= 80 ? "default" : r.percentage >= 60 ? "secondary" : "destructive"}
                            className="w-14 justify-center text-xs"
                          >
                            {r.percentage}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Subject averages */}
                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">教科別平均</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 text-muted-foreground">教科</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">満点</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">平均点</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">平均率</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">受験者数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.subject_averages.map((sa) => (
                            <tr key={sa.subject_name} className="border-b hover:bg-muted/30">
                              <td className="py-2 px-2 font-medium">{sa.subject_name}</td>
                              <td className="py-2 px-2 text-right text-muted-foreground">
                                {sa.max_score}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums">
                                {sa.avg_score}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <Badge
                                  variant={
                                    sa.avg_percentage >= 80
                                      ? "default"
                                      : sa.avg_percentage >= 60
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className="text-xs"
                                >
                                  {sa.avg_percentage}%
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right text-muted-foreground">
                                {sa.student_count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                データを読み込み中...
              </div>
            )}
          </TabsContent>

          {/* Compressed Score Tab */}
          <TabsContent value="compressed" className="space-y-4">
            {selectedStudentId ? (
              <CompressedScoreCalculator
                studentId={selectedStudentId}
                examMaterialId={selectedExamId}
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                生徒を選択してください
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
