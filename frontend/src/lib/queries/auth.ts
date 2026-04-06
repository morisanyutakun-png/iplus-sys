import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";

export interface AppUser {
  id: number;
  username: string;
  google_email: string | null;
  role: "admin" | "trainer";
}

export function useUsers() {
  return useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => apiFetch<AppUser[]>("/api/auth/users"),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { display_name: string; google_email: string; role: "admin" | "trainer" }) =>
      apiFetch<AppUser>("/api/auth/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
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
