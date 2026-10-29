/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query"
import { getMyRole } from "@/actions/content"

export type StudioRole = "reader" | "creator" | "admin"

export function useMyRole(initialRole?: StudioRole | null): {
  role: StudioRole | null
  isAuthor: boolean
  loading: boolean
} {
  const fetchRole = getMyRole
  const { data, isLoading } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
    staleTime: 5 * 60 * 1000,
    ...(initialRole ? { initialData: { roles: [], primary: initialRole as any } } : {})
  })
  const role = (data?.primary ?? initialRole ?? null) as StudioRole | null
  return {
    role,
    isAuthor: role === "creator" || role === "admin",
    loading: initialRole ? false : isLoading,
  }
}
