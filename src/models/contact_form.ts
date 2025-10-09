import z from "zod";

export const ContactFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(3),
  email: z.email(),
  phone: z.string().min(8).max(20).optional(),
  inquiry_type: z.string(),
  subject: z.string(),
  message: z.string(),
  created_at: z.date().optional(),
});

export type ContactForm = z.infer<typeof ContactFormSchema>;
