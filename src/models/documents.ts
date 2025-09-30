import { z } from "zod";

export const DocumentSchema = z.object({
  id: z.uuid().optional(),
  application_id: z.uuid(),
  file_name: z.string(),
  file_path: z.string(),
  file_size: z.bigint(),
  file_type: z.string(),
  uploaded_by: z.uuid(),
  is_required: z.boolean(),
  created_at: z.date().optional(),
});

export const DocumentUpdateSchema = z.object({
  id: z.uuid().optional(),
  application_id: z.uuid().optional(),
  file_name: z.string().optional(),
  file_path: z.string().optional(),
  file_size: z.bigint().optional(),
  file_type: z.string().optional(),
  uploaded_by: z.uuid().optional(),
  is_required: z.boolean().optional(),
  created_at: z.date().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;
export type DocumentUpdate = z.infer<typeof DocumentUpdateSchema>;
