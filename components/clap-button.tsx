"use client"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { Hand } from "lucide-react"
import { getMyClaps, getPieceClapStats, setMyClaps } from "@/actions/claps"
import { cn, formatCompactNumber } from "@/lib/utils"
import { toast } from "sonner"

const MAX = 50
const HOLD_DELAY = 400
const HOLD_EVERY = 110
const SAVE_AFTER = 450

type ProviderProps = { pieceId: string; authed: boolean; onSignInRequired?: () => void }

// One piece's clap state + persistence, shared by the bar button and the More menu's undo.
function useClapState({ pieceId, authed, onSignInRequired }: ProviderProps) {
  const [total, setTotal] = useState(0)
  const [mine, setMine] = useState(0)
  const [pulse, setPulse] = useState(0)
  const mineRef = useRef(0)
  const saved = useRef(0) // what the server last confirmed
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let live = true
    getPieceClapStats({ data: { piece_id: pieceId } }).then((s) => live && setTotal(s.total)).catch(() => {})
    if (authed)
      getMyClaps({ data: { piece_id: pieceId } })
        .then((r) => {
          if (!live) return
          mineRef.current = saved.current = r.count
          setMine(r.count)
        })
        .catch(() => {})
    return () => {
      live = false
    }
  }, [pieceId, authed])

  const save = async (n: number) => {
    if (n === saved.current) return
    const before = saved.current
    try {
      await setMyClaps({ data: { piece_id: pieceId, count: n } })
      saved.current = n
    } catch (e) {
      // Put the screen back to what the server actually has.
      setTotal((t) => t - (mineRef.current - before))
      mineRef.current = before
      setMine(before)
      toast.error((e as Error).message)
    }
  }

  const flush = () => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = null
    void save(mineRef.current)
  }

  const setCount = (n: number) => {
    const next = Math.max(0, Math.min(MAX, n))
    if (next === mineRef.current) return false
    setTotal((t) => t + (next - mineRef.current))
    mineRef.current = next
    setMine(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      void save(next)
    }, SAVE_AFTER)
    return true
  }

  const bump = () => {
    if (!authed) {
      onSignInRequired?.()
      return false
    }
    const ok = setCount(mineRef.current + 1)
    if (ok) setPulse((p) => p + 1)
    return ok
  }

  const undo = () => {
    setCount(0)
    flush()
    toast.success("Claps removed")
  }

  // Save a pending change instead of dropping it when the reader leaves.
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })
  useEffect(() => () => flushRef.current(), [])

  return { total, mine, pulse, bump, undo, flush }
}

type ClapState = ReturnType<typeof useClapState>
const ClapContext = createContext<ClapState | null>(null)

export function ClapProvider({ children, ...props }: ProviderProps & { children: React.ReactNode }) {
  return <ClapContext.Provider value={useClapState(props)}>{children}</ClapContext.Provider>
}

export const useClaps = () => useContext(ClapContext)

type ButtonProps = Omit<React.ComponentPropsWithRef<"button">, "disabled">

// Press to clap once; hold to keep clapping (up to 50). Pointer events cover mouse,
// touch and pen alike, and a cancelled touch (the page started scrolling) stops the hold.
export function ClapButton({ disabled, className, ...rest }: ButtonProps & { disabled?: boolean }) {
  const state = useContext(ClapContext)
  const [holding, setHolding] = useState(false)
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null)
  const [announce, setAnnounce] = useState("")

  const stop = () => {
    if (delay.current) clearTimeout(delay.current)
    if (repeat.current) clearInterval(repeat.current)
    delay.current = repeat.current = null
    if (holding && state) setAnnounce(`${state.mine} claps from you`)
    setHolding(false)
  }
  useEffect(
    () => () => {
      if (delay.current) clearTimeout(delay.current)
      if (repeat.current) clearInterval(repeat.current)
    },
    []
  )
  if (!state) return null
  const { total, mine, pulse, bump, flush } = state

  return (
    <>
      <button
        type="button"
        {...rest}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return
          e.preventDefault()
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {} // unknown pointer (synthetic events); the hold still ends on pointerup
          if (!bump()) return
          setHolding(true)
          delay.current = setTimeout(() => {
            repeat.current = setInterval(() => {
              if (!bump()) stop()
            }, HOLD_EVERY)
          }, HOLD_DELAY)
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          // Keyboard activation; pointer presses already clapped on pointerdown.
          if (e.detail === 0 && !disabled && bump()) setAnnounce(`${mine + 1} claps from you`)
        }}
        onBlur={flush}
        aria-disabled={disabled || undefined}
        aria-label={`Clap. ${formatCompactNumber(total)} claps`}
        title={
          disabled
            ? "You can't clap for your own piece"
            : `Clap, or hold to clap up to ${MAX} times (you: ${mine}/${MAX})`
        }
        className={cn(
          "relative inline-flex touch-none items-center gap-1.5 select-none [-webkit-touch-callout:none]",
          className,
          mine > 0 && "text-primary",
          holding && "scale-95",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <Hand className="size-4" aria-hidden />
        <span className="tabular-nums">{formatCompactNumber(total)}</span>
        {pulse > 0 && holding && (
          <span
            key={pulse}
            aria-hidden
            className="animate-scale-in pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 font-mono text-xs text-primary-foreground"
          >
            +{mine}
          </span>
        )}
      </button>
      {/* Screen readers hear the result once, not every clap. */}
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </>
  )
}
