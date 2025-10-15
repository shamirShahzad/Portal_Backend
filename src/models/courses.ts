import { z } from "zod";

export const CourseSchema = z.object({
  id: z.uuid().optional(),
  title: z.string(),
  subtitle: z.string(),
  category: z.string(),
  duration: z.string(),
  format: z.string(),
  level: z.string(),
  description: z.string(),
  prerequisites: z.array(z.string()),
  thumbnail_url: z.string(),
  price: z.number(),
  is_active: z.boolean(),
  is_tamkeen_support: z.boolean(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const CourseUpdateSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  category: z.string().optional(),
  duration: z.string().optional(),
  format: z.string().optional(),
  level: z.string().optional(),
  description: z.string().optional(),
  prerequisites: z.array(z.string()).optional(),
  thumbnail_url: z.string().optional(),
  price: z.number().optional(),
  is_active: z.boolean().optional(),
  is_tamkeen_support: z.boolean().optional(),
  updated_at: z.date().optional().optional(),
})

export type Course = z.infer<typeof CourseSchema>;
export type CourseUpdate = z.infer<typeof CourseUpdateSchema>
