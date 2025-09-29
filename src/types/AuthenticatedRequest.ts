import type { Request } from "express";
interface User {
  id: string;
  email: string;
  full_name: string;
  employee_id: string;
  phone_number: string;
  role: string;
}
export interface AuthenticatedRequest extends Request {
  user?: User | null;
}