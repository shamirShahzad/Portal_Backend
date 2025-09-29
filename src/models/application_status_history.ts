import { z } from 'zod';

export const ApplicationStatusHistorySchema = z.object({
  id: z.uuid(),
  application_id: z.uuid(),
  old_status: z.string().nullable().optional(),
  new_status: z.string(),
  changed_by: z.uuid(),
  notes: z.string().nullable().optional(),
  created_at: z.date().optional(),
});

export type ApplicationStatusHistory = z.infer<typeof ApplicationStatusHistorySchema>;
