import type { ListNotesOutput, Note, Speaker, Transcript, User } from "../api/types"

function formatUser(user: User): string {
  const name = user.name?.trim() || "Unknown"
  return `${name} <${user.email}>`
}

export function formatTranscriptSpeaker(speaker: Speaker): string {
  return (
    speaker.name?.trim() ||
    speaker.diarization_label?.trim() ||
    speaker.attribution ||
    speaker.source
  )
}

export function formatList(data: ListNotesOutput): string {
  if (data.notes.length === 0) return "No notes found."

  const lines = data.notes.map((n) => {
    const date = new Date(n.created_at).toLocaleDateString()
    const owner = n.owner.name?.trim() || n.owner.email
    return `  ${n.id}  ${date}  ${n.title ?? "Untitled"}  (${owner})`
  })

  return lines.join("\n")
}

export function formatNote(note: Note): string {
  const lines: string[] = [
    `# ${note.title ?? "Untitled"}`,
    "",
    `ID:      ${note.id}`,
    `Owner:   ${formatUser(note.owner)}`,
    `Created: ${new Date(note.created_at).toLocaleString()}`,
    `Updated: ${new Date(note.updated_at).toLocaleString()}`,
  ]

  if (note.web_url) {
    lines.push(`URL:     ${note.web_url}`)
  }

  if (note.calendar_event?.event_title) {
    lines.push(`Event:   ${note.calendar_event.event_title}`)
  }

  if (note.attendees.length > 0) {
    lines.push("", "Attendees:", ...note.attendees.map((a) => `  - ${formatUser(a)}`))
  }

  const summary = note.summary_markdown?.trim() || note.summary_text?.trim()
  if (summary) {
    lines.push("", "## Summary", "", summary)
  }

  if (note.transcript?.length) {
    lines.push("", "## Transcript", "")
    for (const entry of note.transcript as Transcript[]) {
      lines.push(`[${formatTranscriptSpeaker(entry.speaker)}]: ${entry.text}`)
    }
  }

  return lines.join("\n")
}
