"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExamMaterialList } from "@/components/exams/exam-material-list";
import { UniversityWeightManager } from "@/components/exams/university-weight-manager";
import { FileText, GraduationCap, Scale } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart3, ClipboardCheck } from "lucide-react";

export default function ExamsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">試験管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            共通テスト・大学過去問の登録・スコア入力・分析
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/exams/scores">
            <Button variant="outline" size="sm">
              <ClipboardCheck className="mr-1.5 h-4 w-4" />
              スコア入力
            </Button>
          </Link>
          <Link href="/exams/analytics">
            <Button variant="outline" size="sm">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              分析
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="common_test">
        <TabsList>
          <TabsTrigger value="common_test">
            <FileText className="mr-1.5 h-4 w-4" />
            共通テスト
          </TabsTrigger>
          <TabsTrigger value="university_past">
            <GraduationCap className="mr-1.5 h-4 w-4" />
            大学過去問
          </TabsTrigger>
          <TabsTrigger value="weights">
            <Scale className="mr-1.5 h-4 w-4" />
            圧縮点設定
          </TabsTrigger>
        </TabsList>

        <TabsContent value="common_test">
          <ExamMaterialList examType="common_test" />
        </TabsContent>

        <TabsContent value="university_past">
          <ExamMaterialList examType="university_past" />
        </TabsContent>

        <TabsContent value="weights">
          <UniversityWeightManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
