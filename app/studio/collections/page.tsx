"use client"

import { useCallback, useEffect, useState } from "react"
import { myCollections, createCollection } from "@/actions/monetization"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, Library, X } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type Row = Awaited<ReturnType<typeof myCollections>>[number]

export default function MyCollectionsPage() {
  const list = myCollections
  const create = createCollection
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")

  const reload = useCallback(
    () =>
      list()
        .then(setRows)
        .catch(() => {}),
    [list]
  )
  useEffect(() => {
    reload()
  }, [reload])

  const submit = async () => {
    if (title.trim().length < 2) return
    try {
      await create({
        data: {
          title: title.trim(),
          description: desc.trim() || undefined,
          is_public: true,
          price_paise: 0,
        },
      })
      toast.success("Collection created")
      setTitle("")
      setDesc("")
      setOpen(false)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="mx-auto w-full max-w-350 space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl">My collections</h1>
          <p className="text-sm text-muted-foreground">
            Curate reading paths. Earn 15% on paid collections.
          </p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>
          {open ? (
              <>
                <X className="mr-2 size-4" /> Close
              </>
            ) : (
              <>
                <Plus className="mr-2 size-4" /> New Collection
              </>
            )}
        </Button>
      </header>

      {open && (
        <div className="surface space-y-3 rounded-md p-5">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={submit}>Create</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Library className="size-4" /> No collections yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/collections/${c.id}`}
                className="surface block rounded-md p-4 no-underline hover:border-foreground/40"
              >
                <h2 className="font-display text-lg">{c.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.is_public ? "Public" : "Private"}
                  {c.price_paise > 0 && ` · ₹${c.price_paise / 100}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
