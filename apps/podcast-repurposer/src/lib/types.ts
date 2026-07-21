export interface Chapter {
  timestamp: string;
  title: string;
}

export interface EpisodeOutputs {
  blogPost: string;
  showNotes: string;
  socialSnippets: string[];
  chapters: Chapter[];
}

export interface GenerateRequest {
  title: string;
  transcript: string;
  /** Optional client-supplied Anthropic key (overrides server env when present). */
  apiKey?: string;
}

export interface HistoryEntry {
  id: string;
  title: string;
  createdAt: string;
  transcriptPreview: string;
  outputs: EpisodeOutputs;
}
