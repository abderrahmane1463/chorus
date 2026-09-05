/**
 * Per-interaction configuration. Stored as JSONB so each interaction type can
 * carry its own knobs without a column explosion. Every field is optional and
 * has a default applied in `lib/interactions/defaults.ts`.
 */
export type InteractionSettings = {
  // Multiple choice
  allowMultiple?: boolean;
  maxSelections?: number;
  allowChangeAnswer?: boolean;
  showResultsToParticipants?: boolean;

  // Word cloud
  maxEntriesPerParticipant?: number;

  // Rating
  scaleMin?: number;
  scaleMax?: number;
  minLabel?: string;
  maxLabel?: string;

  // Open text
  maxLength?: number;
  allowMultipleSubmissions?: boolean;

  // Q&A
  allowAnonymous?: boolean;
  moderationEnabled?: boolean;
  allowUpvotes?: boolean;

  // Quiz question
  timeLimitSeconds?: number;
  points?: number;
  speedBonus?: boolean;
  explanation?: string;

  // Survey
  navigationMode?: 'one_by_one' | 'all_at_once';
};

/** Shape of `responses.response_data`, discriminated by the interaction type. */
export type ResponseData =
  | { kind: 'multiple_choice'; optionIds: string[] }
  | { kind: 'word_cloud'; word: string; normalized: string }
  | { kind: 'rating'; value: number }
  | { kind: 'open_text'; text: string }
  | { kind: 'ranking'; optionIds: string[] }
  | { kind: 'quiz'; optionIds: string[]; answeredAtMs: number; correct: boolean; points: number };
