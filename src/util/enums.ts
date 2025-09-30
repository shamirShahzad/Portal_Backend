export const user_role = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  APPLICANT: "applicant",
} as const;
export type user_role = (typeof user_role)[keyof typeof user_role];

export const application_status = {
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export type application_status =
  (typeof application_status)[keyof typeof application_status];

export const priority_level = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;
export type priority_level =
  (typeof priority_level)[keyof typeof priority_level];

export const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type STATUS_CODES = (typeof STATUS_CODES)[keyof typeof STATUS_CODES];
