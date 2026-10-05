import { z } from 'zod';

export const askQuestionSchema = z.object({
  interactionId: z.string().uuid(),
  text: z
    .string()
    .trim()
    .min(3, 'validation.questionTooShort')
    .max(500, 'validation.questionTooLong'),
  isAnonymous: z.boolean().default(false),
});

export const questionIdSchema = z.object({
  questionId: z.string().uuid(),
});

export const moderateQuestionSchema = z.object({
  questionId: z.string().uuid(),
  action: z.enum([
    'approved',
    'answered',
    'hidden',
    'archived',
    'delete',
    'highlight',
    'unhighlight',
  ]),
});

export type AskQuestionInput = z.infer<typeof askQuestionSchema>;
