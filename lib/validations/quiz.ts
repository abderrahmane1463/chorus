import { z } from 'zod';

export const quizIdSchema = z.object({ quizId: z.string().uuid() });

export const quizQuestionOptionSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().trim().min(1, 'Answers cannot be empty').max(160),
  isCorrect: z.boolean(),
});

export const saveQuizQuestionSchema = z.object({
  questionId: z.string().uuid(),
  title: z.string().trim().min(1, 'Add a question').max(300),
  timeLimitSeconds: z.number().int().min(5).max(180),
  points: z.number().int().min(100).max(5000),
  speedBonus: z.boolean(),
  explanation: z.string().trim().max(300).optional().or(z.literal('')),
  options: z.array(quizQuestionOptionSchema).min(2).max(6),
});

export const quizControlSchema = z.object({
  quizId: z.string().uuid(),
  action: z.enum(['start', 'next', 'reveal', 'finish', 'restart']),
});

export const submitQuizAnswerSchema = z.object({
  questionId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).min(1).max(6),
});

export type SaveQuizQuestionInput = z.infer<typeof saveQuizQuestionSchema>;

export const quizQuestionIdSchema = z.object({
  questionId: z.string().uuid(),
});
