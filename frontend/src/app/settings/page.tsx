"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  useUsers,
  useCreateTrainer,
  useDeleteUser,
  useUpdatePassword,
  type AppUser,
} from "@/lib/queries/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, UserPlus, KeyRound, Shield } from "lucide-react";

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

function CreateTrainerForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const createTrainer = useCreateTrainer();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTrainer.mutateAsync({ username, password });
      setUsername("");
      setPassword("");
      toast.success(`トレーナー「${username}」を追加しました`);
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("409")) {
        toast.error("そのユーザー名は既に使われています");
      } else {
        toast.error("追加に失敗しました");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1 space-y-1">
        <label className="text-xs font-medium text-muted-foreground">ユーザー名（3文字以上）</label>
        <Input
          placeholder="trainer01"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={64}
          required
        />
      </div>
      <div className="flex-1 space-y-1">
        <label className="text-xs font-medium text-muted-foreground">パスワード（8文字以上）</label>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <Button type="submit" disabled={createTrainer.isPending} className="gap-2">
        <UserPlus className="h-4 w-4" />
        追加
      </Button>
    </form>
  );
}

function PasswordResetDialog({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const updatePassword = useUpdatePassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePassword.mutateAsync({ id: user.id, password });
      toast.success(`「${user.username}」のパスワードを変更しました`);
      onClose();
    } catch {
      toast.error("パスワード変更に失敗しました");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-premium space-y-4">
        <h3 className="font-semibold">パスワード変更: {user.username}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="新しいパスワード（8文字以上）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoFocus
            required
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={updatePassword.isPending} className="flex-1">
              変更
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const deleteUser = useDeleteUser();
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);

  if (currentUser?.role !== "admin") return null;

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`「${u.username}」を削除しますか？`)) return;
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
          <p className="text-sm text-muted-foreground">トレーナーアカウントの追加・削除</p>
        </div>
      </div>

      {/* Create trainer */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">トレーナーを追加</h2>
        <CreateTrainerForm onCreated={() => {}} />
      </div>

      {/* User list */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-sm font-semibold">ユーザー一覧</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">読み込み中...</div>
        ) : (
          <ul className="divide-y">
            {(users ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{u.username}</span>
                  <RoleBadge role={u.role} />
                  {u.id === currentUser?.id && (
                    <span className="text-[10px] text-muted-foreground">(自分)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => setResetTarget(u)}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span className="text-xs">PW変更</span>
                  </Button>
                  {u.role !== "admin" && u.id !== currentUser?.id && (
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

      {resetTarget && (
        <PasswordResetDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </div>
  );
}
