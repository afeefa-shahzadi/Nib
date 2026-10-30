"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  addPayoutMethod,
  listMyPayoutMethods,
  deletePayoutMethod,
  setDefaultPayoutMethod,
  type MaskedPayoutMethod,
} from "@/actions/monetization/payout-methods"
import {
  validatePayoutMethod,
  type PayoutMethodInput,
} from "@/lib/payouts/validate"

const EMPTY = {
  account_name: "",
  account_number: "",
  ifsc: "",
  vpa: "",
  pan: "",
}

export function PayoutMethods({
  onChange,
}: {
  onChange?: (methods: MaskedPayoutMethod[]) => void
}) {
  const [methods, setMethods] = useState<MaskedPayoutMethod[]>([])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [type, setType] = useState<"bank_account" | "vpa">("vpa")
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reload = useCallback(() => {
    listMyPayoutMethods()
      .then((m) => {
        setMethods(m)
        onChange?.(m)
      })
      .catch(() => {})
  }, [onChange])
  useEffect(() => reload(), [reload])

  const field = (k: keyof typeof EMPTY) => ({
    id: `pm-${k}`,
    className: "mt-2 min-h-11",
    value: form[k],
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `pm-${k}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
  })
  const err = (k: string) =>
    errors[k] && (
      <p id={`pm-${k}-error`} className="mt-1 text-sm text-destructive">
        {errors[k]}
      </p>
    )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const input: PayoutMethodInput = { method_type: type, ...form }
    const found = validatePayoutMethod(input) as Record<string, string>
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      const r = await addPayoutMethod({ data: input })
      if (r.success) {
        toast.success("Payout method saved.")
        setForm(EMPTY)
        setAdding(false)
        reload()
      } else toast.error(r.error || "Couldn't save the payout method.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const r = await deletePayoutMethod({ data: { id } })
    if (r.success) reload()
    else toast.error(r.error || "Couldn't remove the payout method.")
  }

  const makeDefault = async (id: string) => {
    await setDefaultPayoutMethod({ data: { id } })
    reload()
  }

  return (
    <section className="surface rounded-lg p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl text-foreground">Payout methods</h2>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" aria-hidden />
          Add method
        </Button>
      </div>

      {methods.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {methods.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-foreground">{m.label}</span>
                  {m.is_default && (
                    <Badge variant="secondary" className="font-normal">
                      Default
                    </Badge>
                  )}
                </span>
                <span className="block text-muted-foreground">
                  PAN ending {m.pan_last4}
                </span>
              </span>
              <span className="flex gap-1">
                {!m.is_default && (
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => makeDefault(m.id)}
                  >
                    Set default
                  </Button>
                )}
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      className="min-h-11 text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  }
                  title="Remove this payout method?"
                  description={`${m.label} will no longer receive payouts. You can add it again later.`}
                  confirmLabel="Remove"
                  destructive
                  onConfirm={() => remove(m.id)}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add a UPI ID or bank account to receive payouts.
        </p>
      )}

      <Dialog
        open={adding}
        onOpenChange={(o) => {
          setAdding(o)
          if (!o) setErrors({})
        }}
      >
        <DialogContent>
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Add payout method</DialogTitle>
              <DialogDescription>
                Where we send your payouts. Your PAN is needed once; we withhold
                1% TDS against it.
              </DialogDescription>
            </DialogHeader>

            <div className="my-6 space-y-4">
              <div>
                <Label htmlFor="pm-type">Type</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as "bank_account" | "vpa")}
                >
                  <SelectTrigger id="pm-type" className="mt-2 min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vpa">UPI</SelectItem>
                    <SelectItem value="bank_account">Bank account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {type === "vpa" ? (
                <div>
                  <Label htmlFor="pm-vpa">UPI ID</Label>
                  <Input
                    placeholder="name@bank"
                    autoComplete="off"
                    {...field("vpa")}
                  />
                  {err("vpa")}
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="pm-account_name">Account holder name</Label>
                    <Input autoComplete="name" {...field("account_name")} />
                    {err("account_name")}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="pm-account_number">Account number</Label>
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        {...field("account_number")}
                      />
                      {err("account_number")}
                    </div>
                    <div>
                      <Label htmlFor="pm-ifsc">IFSC</Label>
                      <Input
                        placeholder="HDFC0001234"
                        autoComplete="off"
                        {...field("ifsc")}
                      />
                      {err("ifsc")}
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="pm-pan">PAN</Label>
                <Input
                  placeholder="ABCDE1234F"
                  autoComplete="off"
                  {...field("pan")}
                />
                {err("pan")}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-11" disabled={busy}>
                {busy ? "Saving…" : "Save method"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
      <Label htmlFor="payout-to">Pay to</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="payout-to" className="mt-2 min-h-11 w-full">
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
