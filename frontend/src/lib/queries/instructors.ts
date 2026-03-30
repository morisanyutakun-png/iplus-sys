import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";

export interface Instructor {
  id: number;
  name: string;
}

export function useInstructors() {
  return useQuery<Instructor[]>({
    queryKey: ["instructors"],
    queryFn: async () => {
      const res = await apiFetch("/api/instructors") as { instructors: Instructor[] };
      return res.instructors;
    },
  });
}

export function useCreateInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch("/api/instructors", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instructors"] });
    },
  });
}

export function useDeleteInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/instructors/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instructors"] });
    },
  });
}
