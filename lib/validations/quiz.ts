import { z } from 'zod';

export const quizIdSchema = z.object({ quizId: z.string().uuid() });

export const quizQuestionOptionSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().trim().min(1, 'validation.answerEmpty').max(160),
  isCorrect: z.boolean(),
});

export const saveQuizQuestionSchema = z.object({
  questionId: z.string().uuid(),
  title: z.string().trim().min(1, 'validation.questionRequired').max(300),
  timeLimitSeconds: z.number().int().min(5).max(180),
  points: z.number().int().min(100).max(5000),
  speedBonus: z.boolean(),
  explanation: z.string().trim().max(300).optional().or(z.literal('')),
  /** Picking options, or a number scored by how close it is. */
  answerType: z.enum(['choice', 'number']).default('choice'),
  correctNumber: z.number().finite().optional(),
  unit: z.string().trim().max(20).optional().or(z.literal('')),
  // A numeric question has none; a choice question's are checked in the action.
  options: z.array(quizQuestionOptionSchema).max(6),
});

export const quizControlSchema = z.object({
  quizId: z.string().uuid(),
  // `open` shows the lobby; `start` leaves it for the first question.
  action: z.enum(['open', 'start', 'next', 'reveal', 'finish', 'restart']),
});

export const submitQuizAnswerSchema = z.object({
  questionId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).max(6).default([]),
  /** The answer to a numeric question. */
  value: z.number().finite().optional(),
});

export type SaveQuizQuestionInput = z.infer<typeof saveQuizQuestionSchema>;

export const quizQuestionIdSchema = z.object({
  questionId: z.string().uuid(),
});
