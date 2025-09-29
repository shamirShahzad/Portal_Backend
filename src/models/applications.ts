import { z } from "zod";
import { application_status, priority_level } from "../util/enums";

export const ApplicationSchema = z.object({
  id: z.uuid().optional(),
  applicant_id: z.uuid(),
  course_id: z.uuid(),
  status: z.enum(Object.values(application_status) as [string, ...string[]]),
  priority: z.enum(Object.values(priority_level) as [string, ...string[]]),
  submitted_at: z.date().optional(),
  reviewed_at: z.date().nullable().optional(),
  reviewed_by: z.uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export type Application = z.infer<typeof ApplicationSchema>;
