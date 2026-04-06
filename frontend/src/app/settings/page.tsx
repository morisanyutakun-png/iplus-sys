"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  type AppUser,
} from "@/lib/queries/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, UserPlus, Shield, Mail } from "lucide-react";

function RoleBadge({ role }: { role: "admin" | "trainer" }) {
  return (
    <span
      className={
        role === "admin"
          ? "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
      }
    >
      {role === "admin" ? "管理者" : "トレーナー"}
    </span>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [role, setRole] = useState<"admin" | "trainer">("trainer");
  const createUser = useCreateUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync({ display_name: displayName, google_email: googleEmail, role });
      setDisplayName("");
      setGoogleEmail("");
      setRole("trainer");
      toast.success(`「${displayName}」を追加しました`);
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("409")) {
        toast.error("このGoogleアカウントは既に登録されています");
      } else {
        toast.error("追加に失敗しました");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">表示名</label>
          <Input
            placeholder="田中 太郎"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            minLength={1}
            maxLength={64}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Googleメールアドレス</label>
          <Input
            type="email"
            placeholder="example@gmail.com"
            value={googleEmail}
            onChange={(e) => setGoogleEmail(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">ロール</label>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              type="button"
              onClick={() => setRole("trainer")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                role === "trainer"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              トレーナー
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                role === "admin"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              管理者
            </button>
          </div>
        </div>
        <Button type="submit" disabled={createUser.isPending} className="gap-2 ml-auto">
          <UserPlus className="h-4 w-4" />
          追加
        </Button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const deleteUser = useDeleteUser();

  if (currentUser?.role !== "admin") return null;

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`「${u.username}」を削除しますか？\n(${u.google_email})`)) return;
    try {
      await deleteUser.mutateAsync(u.id);
      toast.success(`「${u.username}」を削除しました`);
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">アカウント管理</h1>
          <p className="text-sm text-muted-foreground">許可するGoogleアカウントの追加・削除</p>
        </div>
      </div>

      {/* Create user */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">ユーザーを追加</h2>
        <CreateUserForm onCreated={() => {}} />
      </div>

      {/* User list */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-sm font-semibold">許可済みユーザー一覧</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">読み込み中...</div>
        ) : (
          <ul className="divide-y">
            {(users ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{u.username}</span>
                      <RoleBadge role={u.role} />
                      {u.id === currentUser?.id && (
                        <span className="text-[10px] text-muted-foreground">(自分)</span>
                      )}
                    </div>
                    {u.google_email && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">{u.google_email}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {u.id !== currentUser?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(u)}
                      disabled={deleteUser.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="text-xs">削除</span>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
