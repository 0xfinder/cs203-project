import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ExampleItem {
  id: number;
  title: string;
}

const EXAMPLES_KEY = ["examples"] as const;

export function useExamples() {
  return useQuery({
    queryKey: EXAMPLES_KEY,
    queryFn: () => api.get("examples").json<ExampleItem[]>(),
  });
}

export function useExample(id: number) {
  return useQuery({
    queryKey: [...EXAMPLES_KEY, id],
    queryFn: () => api.get(`examples/${id}`).json<ExampleItem>(),
    enabled: id > 0,
  });
}

export function useCreateExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) =>
      api.post("examples", { json: { title } }).json<ExampleItem>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXAMPLES_KEY });
    },
  });
}
