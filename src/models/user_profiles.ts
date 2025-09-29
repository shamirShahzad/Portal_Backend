import { z } from "zod";
import { user_role } from "../util/enums";

export const UserProfileSchema = z.object({
  id: z.uuid().optional(),
  full_name: z.string(),
  employee_id: z.string(),
  department: z.string(),
  phone_number: z.string(),
  sub_organization: z.string(),
  job_title: z.string(),
  experience_years: z.number().int(),
  manager_name: z.string(),
  manager_email: z.string(),
  role: z.enum(Object.values(user_role) as [string, ...string[]]),
  avatar_url: z.string().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
