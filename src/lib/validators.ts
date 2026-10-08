import { z } from "zod";
import { REJECTION_NOTE_MIN_LENGTH } from "@/lib/constants";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const rejectionNoteSchema = z
  .string()
  .trim()
  .min(
    REJECTION_NOTE_MIN_LENGTH,
    `Reason must be at least ${REJECTION_NOTE_MIN_LENGTH} characters.`,
  );

export const verificationCountSchema = z.object({
  componentId: z.string().min(1),
  actualQty: z.number().int().nonnegative(),
});

export const rejectionRequestSchema = z.object({
  note: rejectionNoteSchema,
});

export const orderFormSchema = z.object({
  recipeId: z.string().min(1, "Select a recipe."),
  targetQty: z.coerce
    .number()
    .int("Target quantity must be a whole number.")
    .positive("Target quantity must be greater than zero."),
  fabricRollId: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{3,30}$/i, "Use 3-30 letters, numbers, or hyphens."),
  actualFabricYds: z.coerce
    .number()
    .positive("Fabric usage must be greater than zero.")
    .refine((value) => Number.isInteger(value * 100), "Use at most 2 decimal places."),
});
