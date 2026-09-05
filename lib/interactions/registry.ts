import {
  BarChart3,
  Cloud,
  MessageCircleQuestion,
  ListOrdered,
  MessageSquareText,
  Star,
  Trophy,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import type { InteractionSettings } from '@/types/interactions';

export type InteractionType =
  | 'multiple_choice'
  | 'word_cloud'
  | 'rating'
  | 'open_text'
  | 'ranking'
  | 'q_and_a'
  | 'quiz'
  | 'survey';

export type InteractionMeta = {
  type: InteractionType;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Whether the type needs a list of options the host writes up front. */
  hasOptions: boolean;
  defaults: InteractionSettings;
};

/**
 * Interaction types the host can create today.
 *
 * Types are added here as their editor and participant surfaces land, so the
 * picker never offers something that cannot actually be built yet.
 */
export const INTERACTION_TYPES: InteractionMeta[] = [
  {
    type: 'multiple_choice',
    name: 'Multiple choice',
    description: 'Ask a question with a fixed set of answers and watch the bars fill.',
    icon: BarChart3,
    hasOptions: true,
    defaults: {
      allowMultiple: false,
      maxSelections: 1,
      allowChangeAnswer: true,
      showResultsToParticipants: true,
    },
  },
  {
    type: 'word_cloud',
    name: 'Word cloud',
    description: 'Collect short answers and let the common ones grow larger.',
    icon: Cloud,
    hasOptions: false,
    defaults: {
      maxEntriesPerParticipant: 1,
      showResultsToParticipants: true,
    },
  },
  {
    type: 'rating',
    name: 'Rating',
    description: 'Ask for a number on a scale and see the spread, not just the average.',
    icon: Star,
    hasOptions: false,
    defaults: {
      scaleMin: 1,
      scaleMax: 5,
      minLabel: '',
      maxLabel: '',
      showResultsToParticipants: true,
    },
  },
  {
    type: 'q_and_a',
    name: 'Q&A',
    description: 'Let the room ask questions and upvote the ones they want answered.',
    icon: MessageCircleQuestion,
    hasOptions: false,
    defaults: {
      allowAnonymous: true,
      moderationEnabled: false,
      allowUpvotes: true,
    },
  },
  {
    type: 'ranking',
    name: 'Ranking',
    description: 'Ask people to put options in order and see where the room lands.',
    icon: ListOrdered,
    hasOptions: true,
    defaults: {
      showResultsToParticipants: true,
    },
  },
  {
    type: 'quiz',
    name: 'Quiz',
    description: 'Timed questions with right answers, points for speed, and a leaderboard.',
    icon: Trophy,
    hasOptions: false,
    defaults: {
      timeLimitSeconds: 20,
      points: 1000,
      speedBonus: true,
    },
  },
  {
    type: 'survey',
    name: 'Survey',
    description: 'Several questions answered in one go, with completion tracking.',
    icon: ClipboardList,
    hasOptions: false,
    defaults: {
      navigationMode: 'all_at_once',
    },
  },
  {
    type: 'open_text',
    name: 'Open text',
    description: 'Let people answer in their own words onto a live response wall.',
    icon: MessageSquareText,
    hasOptions: false,
    defaults: {
      maxLength: 280,
      allowMultipleSubmissions: false,
      showResultsToParticipants: false,
    },
  },
];

const BY_TYPE = new Map(INTERACTION_TYPES.map((meta) => [meta.type, meta]));

export function getInteractionMeta(type: string): InteractionMeta | undefined {
  return BY_TYPE.get(type as InteractionType);
}

export const CREATABLE_TYPES = INTERACTION_TYPES.map((meta) => meta.type);

/**
 * How many answers one participant may submit. Everything except word clouds
 * is a single answer, which is what makes the slot-0 unique constraint work.
 */
export function maxEntriesFor(
  type: string,
  settings: InteractionSettings,
): number {
  if (type === 'word_cloud') {
    return Math.min(Math.max(settings.maxEntriesPerParticipant ?? 1, 1), 5);
  }
  if (type === 'open_text' && settings.allowMultipleSubmissions) {
    return 5;
  }
  return 1;
}

/**
 * Question types a survey may contain.
 *
 * Declared here rather than beside the survey queries because the host editor
 * is a client component: importing a runtime value from a `server-only`
 * module would pull that module into the browser bundle.
 */
export const SURVEY_CHILD_TYPES = ['multiple_choice', 'rating', 'open_text'] as const;

export type SurveyChildType = (typeof SURVEY_CHILD_TYPES)[number];
