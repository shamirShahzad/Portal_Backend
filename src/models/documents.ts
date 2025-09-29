import { z } from 'zod';

export const DocumentSchema = z.object({
  id: z.uuid(),
  application_id: z.uuid(),
  file_name: z.string(),
  file_path: z.string(),
  file_size: z.bigint(),
  file_type: z.string(),
  uploaded_by: z.uuid(),
  is_required: z.boolean(),
  created_at: z.date().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;
