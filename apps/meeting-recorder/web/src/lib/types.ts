export type MeetingStatus =
  | "created"
  | "uploading"
  | "uploaded"
  | "processing"
  | "ready"
  | "error";

export interface TranscriptWord { word: string; start: number; end: number; confidence: number; }

export interface TranscriptSegment {
  /** seconds from start */
  start: number;
  /** seconds from start */
  end: number;
  text: string;
  words?: TranscriptWord[];
  confidence?: number;
}

export interface Transcript {
  language?: string;
  text: string;
  segments: TranscriptSegment[];
  words?: TranscriptWord[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Meeting {
  /** stringified ObjectId */
  id: string;
  title: string;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
  durationSec: number;
  /** R2 object key */
  r2Key: string;
  mimeType: string;
  /** public share slug */
  shareId: string;
  transcript: Transcript | null;
  summary: string | null;
  error: string | null;
}

/** What the desktop recorder posts to create a meeting + get an upload URL. */
export interface CreateMeetingRequest {
  title?: string;
  mimeType?: string;
  durationSec?: number;
}

export interface CreateMeetingResponse {
  meeting: Meeting;
  upload: {
    url: string;
    method: "PUT";
    headers: Record<string, string>;
  };
}
