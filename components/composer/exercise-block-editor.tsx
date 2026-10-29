import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BlockDraft } from "./types"
import { Plus, Trash2, GripVertical } from "lucide-react"

interface Props {
  block: BlockDraft
  onUpdateContent: (patch: Partial<BlockDraft["content"]>) => void
}

export function ExerciseBlockEditor({ block, onUpdateContent }: Props) {
  const type = block.content.exerciseType || "short_answer"
  const options = block.content.options || []

  const handleAddOption = () => {
    onUpdateContent({
      options: [
        ...options,
        {
          id: Math.random().toString(36).slice(2),
          text: "",
          isCorrect: false,
          pairText: "",
        },
      ],
    })
  }

  const handleUpdateOption = (index: number, patch: Partial<NonNullable<BlockDraft["content"]["options"]>[number]>) => {
    const newOptions = [...options]
    newOptions[index] = { ...newOptions[index], ...patch }
    onUpdateContent({ options: newOptions })
  }

  const handleRemoveOption = (index: number) => {
    const newOptions = [...options]
    newOptions.splice(index, 1)
    onUpdateContent({ options: newOptions })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          value={type}
          onValueChange={(val) => onUpdateContent({ exerciseType: val as typeof type })}
        >
          <SelectTrigger aria-label="Exercise type" className="h-8 w-48 text-sm">
            <SelectValue placeholder="Exercise Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="short_answer">Short Answer</SelectItem>
            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
            <SelectItem value="multi_select">Multi-Select</SelectItem>
            <SelectItem value="fill_in_the_blanks">
              Fill in the Blanks
            </SelectItem>
            <SelectItem value="poll">Poll</SelectItem>
            <SelectItem value="matching">Matching</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Textarea
          value={block.content.prompt ?? ""}
          onChange={(e) => onUpdateContent({ prompt: e.target.value })}
          rows={2}
          placeholder={
            type === "fill_in_the_blanks"
              ? "Use ___ (three underscores) for blanks..."
              : "Exercise prompt or question..."
          }
        />
        <Input
          value={block.content.hint ?? ""}
          onChange={(e) => onUpdateContent({ hint: e.target.value })}
          placeholder="Optional hint"
          className="text-sm"
        />
      </div>

      {(type === "multiple_choice" ||
        type === "multi_select" ||
        type === "poll") && (
        <div className="space-y-2 rounded-md border border-border bg-muted/10 p-3">
          <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Options
          </p>
          {options.map((opt, i) => (
            <div key={opt.id || i} className="flex items-center gap-2">
              <button className="cursor-grab text-muted-foreground hover:text-foreground">
                <GripVertical className="size-4" />
              </button>
              {type !== "poll" && (
                <input
                  type={type === "multiple_choice" ? "radio" : "checkbox"}
                  name={`correct_${block.uid}`}
                  checked={opt.isCorrect}
                  onChange={(e) => {
                    if (type === "multiple_choice") {
                      const newOptions = options.map((o, idx) => ({
                        ...o,
                        isCorrect: idx === i,
                      }))
                      onUpdateContent({ options: newOptions })
                    } else {
                      handleUpdateOption(i, { isCorrect: e.target.checked })
                    }
                  }}
                  className="size-4"
                  title="Mark as correct answer"
                />
              )}
              <Input
                value={opt.text}
                onChange={(e) =>
                  handleUpdateOption(i, { text: e.target.value })
                }
                placeholder="Option text..."
                className="h-8 text-sm"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleRemoveOption(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-xs"
            onClick={handleAddOption}
          >
            <Plus className="mr-1 size-3" /> Add Option
          </Button>
        </div>
      )}

      {type === "matching" && (
        <div className="space-y-2 rounded-md border border-border bg-muted/10 p-3">
          <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Matching Pairs
          </p>
          {options.map((opt, i) => (
            <div key={opt.id || i} className="flex items-center gap-2">
              <button className="cursor-grab text-muted-foreground hover:text-foreground">
                <GripVertical className="size-4" />
              </button>
              <Input
                value={opt.text}
                onChange={(e) =>
                  handleUpdateOption(i, { text: e.target.value })
                }
                placeholder="Left side..."
                className="h-8 text-sm"
              />
              <span className="text-xs font-medium text-muted-foreground">
                →
              </span>
              <Input
                value={opt.pairText || ""}
                onChange={(e) =>
                  handleUpdateOption(i, { pairText: e.target.value })
                }
                placeholder="Right side..."
                className="h-8 text-sm"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleRemoveOption(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-xs"
            onClick={handleAddOption}
          >
            <Plus className="mr-1 size-3" /> Add Pair
          </Button>
        </div>
      )}

      {(type === "short_answer" || type === "fill_in_the_blanks") && (
        <div className="space-y-2">
          <Textarea
            value={block.content.answer ?? ""}
            onChange={(e) => onUpdateContent({ answer: e.target.value })}
            rows={2}
            placeholder={
              type === "fill_in_the_blanks"
                ? "Answers (comma separated for multiple blanks)"
                : "Answer / model solution (revealed by reader)"
            }
            className="text-sm"
          />
        </div>
      )}
    </div>
  )
}
