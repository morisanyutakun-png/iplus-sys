import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";

export interface AppUser {
  id: number;
  username: string;
  role: "admin" | "trainer";
}

export function useUsers() {
  return useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => apiFetch<AppUser[]>("/api/auth/users"),
  });
}

export function useCreateTrainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      apiFetch<AppUser>("/api/auth/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiFetch(`/api/auth/users/${id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password }),
      }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/auth/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
