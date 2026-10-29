"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  addPayoutMethod,
  listMyPayoutMethods,
  deletePayoutMethod,
  setDefaultPayoutMethod,
  type MaskedPayoutMethod,
} from "@/actions/monetization/payout-methods"
import { validatePayoutMethod, type PayoutMethodInput } from "@/lib/payouts/validate"

export function PayoutMethods({
  onChange,
}: {
  onChange?: (methods: MaskedPayoutMethod[]) => void
}) {
  const [methods, setMethods] = useState<MaskedPayoutMethod[]>([])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [type, setType] = useState<"bank_account" | "vpa">("vpa")
  const [form, setForm] = useState({
    account_name: "", account_number: "", ifsc: "", vpa: "", pan: "",
  })

  const reload = useCallback(() => {
    listMyPayoutMethods()
      .then((m) => {
        setMethods(m)
        onChange?.(m)
      })
      .catch(() => {})
  }, [onChange])
  useEffect(() => reload(), [reload])

  const submit = async () => {
    const input: PayoutMethodInput = { method_type: type, ...form }
    const errors = validatePayoutMethod(input)
    if (Object.keys(errors).length) {
      toast.error(Object.values(errors)[0])
      return
    }
    setBusy(true)
    try {
      const r = await addPayoutMethod({ data: input })
      if (r.success) {
        toast.success("Payout method saved.")
        setForm({ account_name: "", account_number: "", ifsc: "", vpa: "", pan: "" })
        setAdding(false)
        reload()
      } else toast.error(r.error || "Could not save.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const r = await deletePayoutMethod({ data: { id } })
    if (r.success) reload()
    else toast.error(r.error || "Could not remove.")
  }

  const makeDefault = async (id: string) => {
    await setDefaultPayoutMethod({ data: { id } })
    reload()
  }

  return (
    <section className="surface rounded-md p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg">Payout methods</h2>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            Add method
          </Button>
        )}
      </div>

      {methods.length > 0 && (
        <ul className="mb-4 space-y-2">
          {methods.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {m.label}
                <span className="ml-2 text-xs text-muted-foreground">
                  PAN ••{m.pan_last4}
                </span>
                {m.is_default && (
                  <Badge variant="secondary" className="ml-2">
                    default
                  </Badge>
                )}
              </span>
              <span className="flex gap-1.5">
                {!m.is_default && (
                  <Button size="sm" variant="ghost" onClick={() => makeDefault(m.id)}>
                    Set default
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="max-w-50">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "bank_account" | "vpa")}>
              <SelectTrigger aria-label="Payout method type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vpa">UPI</SelectItem>
                <SelectItem value="bank_account">Bank account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "vpa" ? (
            <div className="max-w-80">
              <Label className="text-xs">UPI ID</Label>
              <Input
                placeholder="name@bank"
                value={form.vpa}
                onChange={(e) => setForm((f) => ({ ...f, vpa: e.target.value }))}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Account holder name</Label>
                <Input
                  value={form.account_name}
                  onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Account number</Label>
                <Input
                  value={form.account_number}
                  onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">IFSC</Label>
                <Input
                  placeholder="HDFC0001234"
                  value={form.ifsc}
                  onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="max-w-50">
            <Label className="text-xs">PAN</Label>
            <Input
              placeholder="ABCDE1234F"
              value={form.pan}
              onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Required once — we withhold 1% TDS against it.
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save method"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {methods.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          Add a UPI ID or bank account to receive payouts.
        </p>
      )}
    </section>
  )
}

// A method picker for the withdraw form. Renders nothing when there are no
// saved methods (caller falls back to the free-text destination field).
export function PayoutMethodPicker({
  methods,
  value,
  onChange,
}: {
  methods: MaskedPayoutMethod[]
  value: string
  onChange: (id: string) => void
}) {
  if (methods.length === 0) return null
  return (
    <div className="min-w-50 flex-1">
      <Label className="text-xs">Pay to</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="Pay to">
          <SelectValue placeholder="Choose a payout method" />
        </SelectTrigger>
        <SelectContent>
          {methods.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
