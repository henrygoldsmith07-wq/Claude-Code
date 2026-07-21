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
}

export interface HistoryItem {
  id: string;
  title: string;
  createdAt: string;
  outputs: EpisodeOutputs;
}
