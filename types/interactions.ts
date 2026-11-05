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

  // Collective lighting
  /** The phone's button, in the host's words; empty keeps Chorus's. */
  lightButton?: string;
  /** What the lights converge into on the big screen; empty uses the title. */
  lightText?: string;
  /** How many lights to wait for; empty means everyone in the room. */
  lightTarget?: number;
  /** Reveal by itself once the target is reached, rather than on the host's cue. */
  autoReveal?: boolean;

  // Q&A
  allowAnonymous?: boolean;
  moderationEnabled?: boolean;
  allowUpvotes?: boolean;
  /** The order the host chose for the questions, followed by the big screen. */
  questionSort?: 'votes' | 'newest' | 'oldest';
  /** How the big screen shows the questions: a ranked list, or a wall of cards. */
  display?: 'list' | 'wall';
  /** The host's own invitation in the phone's text box, in place of Chorus's. */
  placeholder?: string;

  // Quiz
  /** Reveal at the buzzer and move to the next question without the host. */
  autoAdvance?: boolean;
  /** Seconds the answer and standings stay up before the next question. */
  revealSeconds?: number;

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
  | { kind: 'light' }
  | { kind: 'open_text'; text: string }
  | { kind: 'ranking'; optionIds: string[] }
  | { kind: 'quiz'; optionIds: string[]; answeredAtMs: number; correct: boolean; points: number };
