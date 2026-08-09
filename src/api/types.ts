/**
 * Types aligned with the Granola public OpenAPI schemas for notes and folders.
 * Sync against: https://docs.granola.ai/api-reference/openapi.json
 */

export interface User {
  name: string | null
  email: string
}

export interface NoteSummary {
  id: string
  object: "note"
  title: string | null
  owner: User
  created_at: string
  updated_at: string
}

export interface CalendarInvitee {
  email: string
}

export interface CalendarEvent {
  event_title: string | null
  invitees: CalendarInvitee[]
  organiser: string | null
  calendar_event_id: string | null
  scheduled_start_time: string | null
  scheduled_end_time: string | null
}

export interface Folder {
  id: string
  object: "folder"
  name: string
  parent_folder_id: string | null
}

export interface Speaker {
  source: "microphone" | "speaker"
  attribution?: "me" | "them"
  diarization_label?: string
  name?: string
}

export interface Transcript {
  speaker: Speaker
  text: string
  start_time: string
  end_time: string
}

export interface Note extends NoteSummary {
  web_url: string
  calendar_event: CalendarEvent | null
  attendees: User[]
  folder_membership: Folder[]
  summary_text: string
  summary_markdown: string | null
  transcript: Transcript[] | null
}

export interface ListNotesOutput {
  notes: NoteSummary[]
  hasMore: boolean
  cursor: string | null
}

export interface ListFoldersOutput {
  folders: Folder[]
  hasMore: boolean
  cursor: string | null
}

export type ListNotesOptions = {
  createdBefore?: string
  createdAfter?: string
  updatedAfter?: string
  folderId?: string
  cursor?: string
  limit?: number
}

export type ListFoldersOptions = {
  cursor?: string
  limit?: number
}
