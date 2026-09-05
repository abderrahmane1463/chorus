/** Channel names. One connection per concern keeps payloads small. */
export const channels = {
  event: (eventId: string) => `event-${eventId}`,
  qa: (eventId: string) => `event-${eventId}-qa`,
  quiz: (eventId: string) => `event-${eventId}-quiz`,
};

export const RealtimeEvent = {
  InteractionStarted: 'INTERACTION_STARTED',
  InteractionStopped: 'INTERACTION_STOPPED',
  InteractionChanged: 'INTERACTION_CHANGED',
  InteractionReset: 'INTERACTION_RESET',
  ResponseCreated: 'RESPONSE_CREATED',
  ResponseUpdated: 'RESPONSE_UPDATED',
  QuestionCreated: 'QUESTION_CREATED',
  QuestionUpdated: 'QUESTION_UPDATED',
  QuestionUpvoted: 'QUESTION_UPVOTED',
  QuizStarted: 'QUIZ_STARTED',
  QuizQuestionChanged: 'QUIZ_QUESTION_CHANGED',
  QuizAnswerRevealed: 'QUIZ_ANSWER_REVEALED',
  QuizFinished: 'QUIZ_FINISHED',
  ParticipantJoined: 'PARTICIPANT_JOINED',
} as const;

export type RealtimeEventName = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

/**
 * Payloads stay deliberately thin: they say *what* changed, not the new data.
 * Clients refetch the authoritative state from the server, so a dropped or
 * out-of-order message can never leave a client showing invented numbers.
 */
export type RealtimeMessage = {
  event: RealtimeEventName;
  eventId: string;
  interactionId?: string;
  questionId?: string;
  at: number;
};
