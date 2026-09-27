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
  icon: LucideIcon;
  /** Whether the type needs a list of options the host writes up front. */
  hasOptions: boolean;
  defaults: InteractionSettings;
};

/**
 * Interaction types the host can create today.
 *
 * Types are added here as their editor and participant surfaces land, so the
 * picker never offers something that cannot actually be built yet. The name
 * and description of each type are translated: see "types" in messages/.
 */
export const INTERACTION_TYPES: InteractionMeta[] = [
  {
    type: 'multiple_choice',
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
    icon: Cloud,
    hasOptions: false,
    defaults: {
      maxEntriesPerParticipant: 1,
      showResultsToParticipants: true,
    },
  },
  {
    type: 'rating',
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
    icon: ListOrdered,
    hasOptions: true,
    defaults: {
      showResultsToParticipants: true,
    },
  },
  {
    type: 'quiz',
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
    icon: ClipboardList,
    hasOptions: false,
    defaults: {
      navigationMode: 'all_at_once',
    },
  },
  {
    type: 'open_text',
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
