"use client"

import { useState, useEffect } from "react"
import { Check, Edit2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { castPollVote, getPollResults } from "@/actions/polls"

type PollResults = { total: number; rows: { option: string; count: number; percent: number }[] }

// Guests vote with a random id kept in this browser, so a refresh doesn't count twice.
function voterId() {
  try {
    let id = localStorage.getItem("nib_voter")
    if (!id) localStorage.setItem("nib_voter", (id = crypto.randomUUID()))
    return id
  } catch {
    return undefined
  }
}

export function InteractiveExercise({
  blockId,
  prompt,
  hint,
  answer,
  exerciseType = "short_answer",
  options = [],
}: {
  blockId: string
  prompt: string
  hint?: string | null
  answer?: string | null
  exerciseType?: string
  options?: { id?: string; text?: string; isCorrect?: boolean; pairText?: string }[]
}) {
  const [userAnswer, setUserAnswer] = useState<string | Record<string, boolean | string>>(
    exerciseType === "multi_select" || exerciseType === "matching" ? {} : ""
  )
  const [isCommitted, setIsCommitted] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [poll, setPoll] = useState<PollResults | null>(null)
  const isPoll = exerciseType === "poll"

  // A returning voter sees the current results straight away.
  useEffect(() => {
    if (isPoll && isCommitted && !poll) getPollResults(blockId).then((r) => r && setPoll(r)).catch(() => {})
  }, [isPoll, isCommitted, poll, blockId])

  const submit = async () => {
    if (!isPoll) return setIsCommitted(true)
    try {
      setPoll(await castPollVote(blockId, userAnswer as string, voterId()))
      setIsCommitted(true)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Load from localStorage on mount
  useEffect(() => {
    setTimeout(() => {
      const saved = localStorage.getItem(`mycelium_exercise_${blockId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.answer !== undefined) setUserAnswer(parsed.answer)
          if (parsed.isCommitted) setIsCommitted(parsed.isCommitted)
        } catch {
          // ignore
        }
      }
      setIsMounted(true)
    }, 0)
  }, [blockId])

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isMounted) return
    localStorage.setItem(
      `mycelium_exercise_${blockId}`,
      JSON.stringify({ answer: userAnswer, isCommitted })
    )
  }, [userAnswer, isCommitted, blockId, isMounted])

  if (!isMounted) {
    return <div className="h-32 animate-pulse rounded-md bg-muted/50" />
  }

  const renderInput = () => {
    if (
      exerciseType === "short_answer" ||
      exerciseType === "fill_in_the_blanks"
    ) {
      return (
        <Textarea
          value={userAnswer as string}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder={
            exerciseType === "fill_in_the_blanks"
              ? "Type your answers here..."
              : "Type your answer here to reveal the author's solution..."
          }
          disabled={isCommitted}
          className="min-h-25 resize-y"
        />
      )
    }

    if (exerciseType === "multiple_choice" || exerciseType === "poll") {
      const validOptions = options.filter(
        (opt) => opt.text && opt.text.trim() !== ""
      )
      return (
        <div className="space-y-2">
          {validOptions.map((opt, i) => {
            const isSelected = userAnswer === opt.text
            const row = isPoll && isCommitted ? poll?.rows.find((r) => r.option === (opt.text ?? "").trim()) : undefined
            if (row) {
              return (
                <div
                  key={opt.id || i}
                  className={`relative overflow-hidden rounded-md border px-4 py-3 ${isSelected ? "border-primary" : "border-border"}`}
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${isSelected ? "bg-primary/20" : "bg-muted"}`}
                    style={{ width: `${row.percent}%` }}
                  />
                  <span className="relative flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2">
                      {opt.text}
                      {isSelected && <Check className="size-4 text-primary" aria-label="Your vote" />}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      <span className="font-medium">{row.percent}%</span>
                      <span className="text-muted-foreground"> · {row.count}</span>
                    </span>
                  </span>
                </div>
              )
            }
            let styleClass =
              "border-border hover:border-primary hover:bg-primary/5"
            if (isSelected && !isCommitted)
              styleClass = "border-primary bg-primary/10"
            if (isCommitted) {
              if (isSelected)
                styleClass = "border-primary bg-primary/10 opacity-70"
              else styleClass = "border-border opacity-50 grayscale"
            }

            return (
              <button
                key={opt.id || i}
                onClick={() => !isCommitted && setUserAnswer(opt.text || "")}
                disabled={isCommitted}
                className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${styleClass}`}
              >
                {opt.text}
              </button>
            )
          })}
        </div>
      )
    }

    if (exerciseType === "multi_select") {
      const validOptions = options.filter(
        (opt) => opt.text && opt.text.trim() !== ""
      )
      return (
        <div className="space-y-2">
          {validOptions.map((opt, i) => {
            const isSelected = !!(userAnswer as Record<string, boolean | string>)[opt.id || i]
            let styleClass =
              "border-border hover:border-primary hover:bg-primary/5"
            if (isSelected && !isCommitted)
              styleClass = "border-primary bg-primary/10"
            if (isCommitted) {
              if (isSelected)
                styleClass = "border-primary bg-primary/10 opacity-70"
              else styleClass = "border-border opacity-50 grayscale"
            }

            return (
              <button
                key={opt.id || i}
                onClick={() =>
                  !isCommitted &&
                  setUserAnswer({ ...(userAnswer as Record<string, boolean | string>), [opt.id || i]: !isSelected })
                }
                disabled={isCommitted}
                className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors ${styleClass}`}
              >
                <span>{opt.text}</span>
                <div
                  className={`size-4 rounded border ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`}
                >
                  {isSelected && (
                    <Check className="m-0.5 size-3 text-primary-foreground" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )
    }

    if (exerciseType === "matching") {
      const validOptions = options.filter(
        (opt) => opt.text && opt.text.trim() !== ""
      )
      return (
        <div className="space-y-3">
          {validOptions.map((opt, i) => (
            <div
              key={opt.id || i}
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <div className="flex-1 rounded-md border border-border bg-muted/30 px-4 py-2 text-sm">
                {opt.text}
              </div>
              <Input
                value={((userAnswer as Record<string, boolean | string>)[opt.id || i] as string) || ""}
                onChange={(e) =>
                  !isCommitted &&
                  setUserAnswer({
                    ...(userAnswer as Record<string, boolean | string>),
                    [opt.id || i]: e.target.value,
                  })
                }
                placeholder="Match with..."
                disabled={isCommitted}
                className="flex-1"
              />
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  const isAnswerEmpty = () => {
    if (typeof userAnswer === "string") return !userAnswer.trim()
    if (typeof userAnswer === "object" && userAnswer !== null)
      return (
        Object.keys(userAnswer).length === 0 ||
        Object.values(userAnswer).every((v) => !v)
      )
    return true
  }

  return (
    <div className="surface my-6 rounded-md border border-success/30 px-5 py-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-success">
          Exercise{" "}
          {exerciseType !== "short_answer" &&
            `· ${exerciseType.replace(/_/g, " ")}`}
        </span>
      </div>

      <p className="mb-4 leading-relaxed font-medium text-foreground/90">
        {prompt || "(empty prompt)"}
      </p>

      {hint && (
        <details className="mb-4 text-sm text-muted-foreground">
          <summary className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground">
            <Info className="size-3" /> Show Hint
          </summary>
          <div className="mt-2 rounded-md bg-muted/30 p-3 text-sm italic">
            {hint}
          </div>
        </details>
      )}

      <div className="space-y-4">
        {renderInput()}

        {!isCommitted ? (
          <Button
            onClick={submit}
            disabled={isAnswerEmpty()}
            className="w-full gap-2 sm:w-auto"
          >
            <Check className="size-4" />
            {isPoll ? "Submit vote" : "Check answer"}
          </Button>
        ) : (
          <div className="mt-4 flex animate-in flex-col gap-4 duration-300 fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCommitted(false)}
                className="gap-2 text-muted-foreground"
              >
                <Edit2 className="size-3" />
                {isPoll ? "Change vote" : "Revise answer"}
              </Button>
              {isPoll && poll && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {poll.total} {poll.total === 1 ? "vote" : "votes"}
                </span>
              )}
            </div>

            {(answer ||
              (options && options.some((o) => o.isCorrect || o.pairText))) &&
              exerciseType !== "poll" && (
                <div className="rounded-md border border-success/20 bg-success/5 p-4">
                  <p className="mb-2 text-xs font-bold text-success">
                    Solution
                  </p>
                  {answer && (
                    <p className="mb-3 text-sm whitespace-pre-wrap text-foreground/90">
                      {answer}
                    </p>
                  )}

                  {(exerciseType === "multiple_choice" ||
                    exerciseType === "multi_select") && (
                    <ul className="list-inside list-disc space-y-1 text-sm font-medium text-success/90">
                      {options
                        .filter((o) => o.isCorrect)
                        .map((o, i) => (
                          <li key={i}>{o.text}</li>
                        ))}
                    </ul>
                  )}

                  {exerciseType === "matching" && (
                    <div className="mt-2 space-y-2">
                      {options.map((o, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="font-medium text-muted-foreground">
                            {o.text}
                          </span>
                          <span className="font-bold text-success">→</span>
                          <span className="text-success">
                            {o.pairText}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  )
}
