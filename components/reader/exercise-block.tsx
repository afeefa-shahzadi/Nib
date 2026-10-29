"use client"

import { Block, getStr, getText } from "../block-renderer"
import { InteractiveExercise } from "./interactive-exercise"

export function ExerciseBlock({ block }: { block: Block }) {
  const prompt = getStr(block.content, "prompt") ?? getText(block.content)
  const answer = getStr(block.content, "answer")
  const hint = getStr(block.content, "hint")
  const exerciseType =
    getStr(block.content, "exerciseType") || "short_answer"
  const options = Array.isArray(block.content.options)
    ? (block.content.options as { id?: string; text?: string; isCorrect?: boolean; pairText?: string }[])
    : undefined

  return (
    <InteractiveExercise
      blockId={block.id ?? "unknown"}
      prompt={prompt}
      hint={hint}
      answer={answer}
      exerciseType={exerciseType}
      options={options}
    />
  )
}
