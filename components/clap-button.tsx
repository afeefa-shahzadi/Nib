"use client"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { Hand } from "lucide-react"
import { getMyClaps, getPieceClapStats, setMyClaps } from "@/actions/claps"
import { cn, formatCompactNumber } from "@/lib/utils"
import { toast } from "sonner"

interface Props {
  pieceId: string
  authed: boolean
  onSignInRequired?: () => void
  /** Compact row button; extra button props (e.g. from a menu item's asChild) are spread onto it. */
  inline?: boolean
  disabled?: boolean
}

type ButtonProps = Omit<React.ComponentPropsWithRef<"button">, keyof Props>

type ProviderProps = Pick<Props, "pieceId" | "authed" | "onSignInRequired">

// One piece's clap state + persistence. Every ClapButton under a ClapProvider shares it,
// so the bar and the aside Applause card always show the same numbers.
function useClapState({ pieceId, authed, onSignInRequired }: ProviderProps) {
  const [total, setTotal] = useState(0)
  const [supporters, setSupporters] = useState(0)
  const [mine, setMine] = useState(0)
  const [pulse, setPulse] = useState(0)
  const saveRef = useRef<NodeJS.Timeout | null>(null)
  const lastSaved = useRef(0)
  // Refs for synchronous reads in timers/cleanup (never stale)
  const mineRef = useRef(0)
  const pieceIdRef = useRef(pieceId)
  useEffect(() => {
    pieceIdRef.current = pieceId
  }, [pieceId])

  useEffect(() => {
    getPieceClapStats({ data: { piece_id: pieceId } })
      .then((s) => {
        setTotal(s.total)
        setSupporters(s.supporters)
      })
      .catch(() => {})
    if (authed) {
      getMyClaps({ data: { piece_id: pieceId } })
        .then((r) => {
          setMine(r.count)
          mineRef.current = r.count
          lastSaved.current = r.count
        })
        .catch(() => {})
    } else {
      mineRef.current = 0
      lastSaved.current = 0
    }
  }, [pieceId, authed])

  const saveNow = async (n: number) => {
    if (n === lastSaved.current) return
    try {
      await setMyClaps({ data: { piece_id: pieceIdRef.current, count: n } })
      lastSaved.current = n
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const persist = (n: number) => {
    if (saveRef.current) clearTimeout(saveRef.current)
    saveRef.current = setTimeout(() => {
      saveRef.current = null
      void saveNow(n)
    }, 450)
  }

  // Save a debounced clap now (unmount, blur) instead of dropping it; failures toast like the normal path.
  const flushPending = () => {
    if (!saveRef.current) return
    clearTimeout(saveRef.current)
    saveRef.current = null
    void saveNow(mineRef.current)
  }

  const bump = () => {
    if (!authed) {
      onSignInRequired?.()
      return
    }
    const current = mineRef.current
    const next = Math.min(50, current + 1)
    if (next === current) return // already at 50

    // All side effects run once here — not inside a setState updater
    mineRef.current = next
    setMine(next)
    setTotal((t) => t + 1)
    if (current === 0) setSupporters((s) => s + 1)
    setPulse((p) => p + 1)
    persist(next)
  }

  const flushRef = useRef(flushPending)
  useEffect(() => {
    flushRef.current = flushPending
  })
  useEffect(() => () => flushRef.current(), [])

  return { total, supporters, mine, pulse, authed, bump, flushPending }
}

type ClapState = ReturnType<typeof useClapState>
const ClapContext = createContext<ClapState | null>(null)

export function ClapProvider({ children, ...props }: ProviderProps & { children: React.ReactNode }) {
  return <ClapContext.Provider value={useClapState(props)}>{children}</ClapContext.Provider>
}

export function ClapButton({ pieceId, authed, onSignInRequired, ...rest }: Props & ButtonProps) {
  const shared = useContext(ClapContext)
  if (shared) return <ClapView state={shared} {...rest} />
  return (
    <ClapProvider pieceId={pieceId} authed={authed} onSignInRequired={onSignInRequired}>
      <ClapButton pieceId={pieceId} authed={authed} onSignInRequired={onSignInRequired} {...rest} />
    </ClapProvider>
  )
}

function ClapView({
  state,
  inline,
  disabled,
  ...buttonProps
}: { state: ClapState } & Pick<Props, "inline" | "disabled"> & ButtonProps) {
  const { total, supporters, mine, pulse, authed, flushPending } = state
  const [holding, setHolding] = useState(false)
  const holdRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const bump = () => {
    if (!disabled) state.bump()
  }

  const startHold = () => {
    bump()
    setHolding(true)
    timeoutRef.current = setTimeout(() => {
      holdRef.current = setInterval(bump, 110)
    }, 400)
  }
  const stopHold = () => {
    setHolding(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (holdRef.current) {
      clearInterval(holdRef.current)
      holdRef.current = null
    }
  }

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (holdRef.current) clearInterval(holdRef.current)
    },
    []
  )

  if (inline) {
    return (
      <button
        {...buttonProps}
        onMouseDown={startHold}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={(e) => {
          e.preventDefault()
          startHold()
        }}
        onTouchEnd={stopHold}
        onBlur={(e) => {
          flushPending()
          buttonProps.onBlur?.(e)
        }}
        onClick={(e) => {
          // Keyboard activation (mouse/touch already clapped on press).
          if (e.detail === 0) bump()
          buttonProps.onClick?.(e)
        }}
        aria-label={`Clap ${formatCompactNumber(total)} (you: ${mine}/50)`}
        aria-disabled={disabled}
        title={disabled ? "You cannot applaud your own piece!" : `Clap (you: ${mine}/50)`}
        className={cn(
          "relative inline-flex items-center gap-1.5 select-none",
          buttonProps.className,
          mine > 0 && "text-primary",
          holding && "scale-95",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Hand className="size-4" />
        <span className="tabular-nums">{formatCompactNumber(total)}</span>
      </button>
    )
  }

  return (
    <div className="surface rounded-md p-5">
      <p className="mb-3 text-xs tracking-wider text-muted-foreground uppercase">
        Applause
      </p>
      <div className="flex items-center gap-4">
        <button
          onMouseDown={startHold}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={(e) => {
            e.preventDefault()
            startHold()
          }}
          onTouchEnd={stopHold}
          aria-label={`Clap (you: ${mine}/50)`}
          aria-disabled={disabled}
          title={disabled ? "You cannot applaud your own piece!" : `Clap (you: ${mine}/50)`}
          className={cn(
            "relative size-14 rounded-full border-2 transition-all select-none",
            "flex items-center justify-center",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            mine > 0
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary",
            holding && "scale-95",
            disabled && "opacity-50 cursor-not-allowed hover:border-border hover:text-muted-foreground bg-transparent"
          )}
        >
          <Hand
            className={cn(
              "size-6 transition-transform",
              mine > 0 && "drop-shadow-[0_0_8px_var(--color-primary)]"
            )}
          />
          {pulse > 0 && (
            <span
              key={pulse}
              aria-hidden
              className="animate-scale-in pointer-events-none absolute -top-2 -right-2 rounded-full bg-primary px-1.5 py-0.5 font-mono text-xs text-primary-foreground"
            >
              +1
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl text-foreground tabular-nums">
            {formatCompactNumber(total)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatCompactNumber(supporters)} {supporters === 1 ? "reader" : "readers"}
            {authed && mine > 0 && (
              <>
                {" "}
                · <span className="text-primary">you: {mine}/50</span>
              </>
            )}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Hold to clap up to 50 times. Authors see who their most enthusiastic
        readers are.
      </p>
    </div>
  )
}
