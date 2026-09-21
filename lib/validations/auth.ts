import { z } from 'zod';

// Translation keys, resolved with t(message) on whichever side reports them.

export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'validation.nameTooShort').max(80),
  email: z.string().trim().toLowerCase().email('validation.emailInvalid'),
  password: z
    .string()
    .min(8, 'validation.passwordTooShort')
    .max(200, 'validation.passwordTooLong'),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('validation.emailInvalid'),
  password: z.string().min(1, 'validation.passwordRequired'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
