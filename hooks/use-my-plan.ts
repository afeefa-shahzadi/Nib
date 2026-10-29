import { useQuery } from "@tanstack/react-query"
import { getMyPlan } from "@/actions/subscriptions"

export function useMyPlan() {
  const fn = getMyPlan
  const q = useQuery({
    queryKey: ["my-plan"],
    queryFn: () => fn(),
    staleTime: 60_000,
  })
  return {
    plan: q.data?.plan ?? "free",
    isStudio: q.data?.plan === "studio",
    subscription: q.data?.subscription ?? null,
    launchFree: q.data?.launchFree ?? true,
    loading: q.isLoading,
    refetch: q.refetch,
  }
}
