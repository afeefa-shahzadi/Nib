"use client"
import { useState, useEffect, useRef } from "react"
import { Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { canUseFreeDictation } from "@/actions/accessibility"

interface VoiceDictationProps {
  onTranscript: (text: string) => void
}

export function VoiceDictation({ onTranscript }: VoiceDictationProps) {
  const [isDictating, setIsDictating] = useState(false)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  // Hold the live recognizer so Stop can actually stop it. Without this it was a
  // function-local, so Stop only flipped the icon while the mic kept listening
  // (and onresult kept inserting text).
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    canUseFreeDictation().then(setHasAccess).catch(() => setHasAccess(false))
  }, [])

  if (hasAccess === false) return null

  const toggleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop()
      setIsDictating(false)
      return
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Your browser does not support Voice Dictation.")
      return
    }

    interface SpeechRecognitionType {
      continuous: boolean
      interimResults: boolean
      onstart: () => void
      onresult: (event: { results: { transcript: string }[][] }) => void
      onerror: (event: { error: string }) => void
      onend: () => void
      start: () => void
      stop: () => void
    }

    const WindowWithSpeech = window as unknown as {
      SpeechRecognition: new () => SpeechRecognitionType
      webkitSpeechRecognition: new () => SpeechRecognitionType
    }

    const SpeechRecognitionCtor = WindowWithSpeech.SpeechRecognition || WindowWithSpeech.webkitSpeechRecognition
    const recognition = new SpeechRecognitionCtor()
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsDictating(true)
      toast.success("Listening... Speak your text.")
    }

    recognition.onresult = (event: Parameters<SpeechRecognitionType["onresult"]>[0]) => {
      const transcript = event.results[0][0].transcript
      onTranscript(transcript)
    }

    recognition.onerror = (event: Parameters<SpeechRecognitionType["onerror"]>[0]) => {
      console.error(event.error)
      toast.error("Dictation error: " + event.error)
      setIsDictating(false)
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsDictating(false)
    }

    recognition.start()
  }

  return (
    <Button
      variant={isDictating ? "default" : "outline"}
      size="sm"
      onClick={toggleDictation}
      title="Voice Dictation (Free for Motor Impaired / Premium)"
      className={`fixed bottom-6 right-6 rounded-full shadow-lg h-12 w-12 p-0 ${isDictating ? "bg-destructive hover:bg-destructive animate-pulse" : "bg-background"}`}
    >
      {isDictating ? <Mic className="size-5 text-destructive-foreground" /> : <MicOff className="size-5" />}
    </Button>
  )
}
