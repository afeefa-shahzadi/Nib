/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import { searchProfiles } from "@/actions/search"
import { addRecommendation, removeRecommendation } from "@/actions/network"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Search, X, Check } from "lucide-react"
import Image from "next/image"

type ProfileResult = {
  id: string
  handle: string
  display_name: string
  avatar_url: string | null
  bio: string | null
}

export type Recommendation = {
  id: string
  blurb: string | null
  created_at: string
  profiles: ProfileResult
}

export function NetworkClient({
  initialRecommendations,
}: {
  initialRecommendations: Recommendation[]
}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    initialRecommendations
  )
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProfileResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [blurbs, setBlurbs] = useState<Record<string, string>>({})

  const searchFn = searchProfiles
  const addFn = addRecommendation
  const removeFn = removeRecommendation

  const handleSearch = async (e?: React.SubmitEvent<HTMLFormElement>) => {
    if (e) e.preventDefault()
    if (!query.trim()) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await searchFn({ data: { q: query } })
      setResults(res || [])
    } catch (e: any) {
      if (e instanceof Error) toast.error(e.message)
    } finally {
      setIsSearching(false)
    }
  }

  const handleRecommend = async (profileId: string) => {
    try {
      await addFn({
        data: { recommendedId: profileId, blurb: blurbs[profileId] || "" },
      })
      toast.success("Recommendation added")
      setQuery("")
      setResults([])
      setBlurbs((prev) => {
        const next = { ...prev }
        delete next[profileId]
        return next
      })
      // Optimistic update would be better, but we can just reload or update state manually.
      window.location.reload()
    } catch (e: any) {
      if (e instanceof Error) toast.error(e.message)
    }
  }

  const handleRemove = async (profileId: string) => {
    try {
      await removeFn({ data: { recommendedId: profileId } })
      toast.success("Recommendation removed")
      setRecommendations((prev) =>
        prev.filter((r) => r.profiles.id !== profileId)
      )
    } catch (e: any) {
      if (e instanceof Error) toast.error(e.message)
    }
  }

  return (
    <div className="grid items-start gap-12 md:grid-cols-2">
      {/* Search & Add */}
      <div className="sticky top-8 space-y-6">
        <div className="surface rounded-md border border-border p-6 shadow-sm">
          <h2 className="mb-4 font-display text-xl text-foreground">
            Endorse a Creator
          </h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (!e.target.value.trim()) setResults([])
              }}
              placeholder="Search by handle or name..."
              className="flex-1"
            />
            <Button type="submit" disabled={isSearching}>
              <Search className="size-4" />
            </Button>
          </form>

          {results.length > 0 && (
            <div className="mt-6 space-y-4">
              {results.map((p) => (
                <div key={p.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {p.avatar_url ? (
                        <Image
                          src={p.avatar_url}
                          className="size-10 rounded-full"
                          alt=""
                        />
                      ) : (
                        <div className="size-10 rounded-full bg-muted" />
                      )}
                      <div>
                        <div className="font-medium">{p.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          @{p.handle}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Input
                      placeholder="Why do you recommend them? (optional)"
                      value={blurbs[p.id] || ""}
                      onChange={(e) =>
                        setBlurbs((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      className="text-sm"
                    />
                    <Button size="sm" onClick={() => handleRecommend(p.id)}>
                      <Check className="mr-1 size-4" /> Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {query.trim() && results.length === 0 && !isSearching && (
            <div className="mt-6 rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
              No creators or readers found.
            </div>
          )}
        </div>
      </div>

      {/* Existing Recommendations */}
      <div>
        <h2 className="mb-4 font-display text-xl text-foreground">
          Your Endorsements
        </h2>
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t recommended anyone yet.
            </p>
          ) : (
            recommendations.map((r) => (
              <div
                key={r.id}
                className="surface flex items-start justify-between rounded-md border border-border p-4 shadow-sm"
              >
                <div className="flex gap-3">
                  {r.profiles.avatar_url ? (
                    <Image
                      src={r.profiles.avatar_url}
                      className="size-10 rounded-full"
                      alt=""
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-muted" />
                  )}
                  <div>
                    <div className="font-medium">{r.profiles.display_name}</div>
                    <div className="text-xs text-muted-foreground">
                      @{r.profiles.handle}
                    </div>
                    {r.blurb && (
                      <div className="mt-2 text-sm text-muted-foreground italic">
                        &quot;{r.blurb}&quot;
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(r.profiles.id)}
                >
                  <X className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
