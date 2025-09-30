// src/util/Errors.ts

function createError(name: string, defaultMessage: string) {
  return (msg?: string) => {
    const err = new Error(msg || defaultMessage);
    err.name = name;

    // Ensure stack trace points to the caller (controller), not here
    if (Error.captureStackTrace) {
      Error.captureStackTrace(err, createError(name, defaultMessage));
    }

    return err;
  };
}

export const INTERNAL_SERVER_ERROR = createError(
  "InternalServerError",
  "Something went wrong"
);
export const BAD_REQUEST_ERROR = createError("BadRequestError", "Bad Request");
export const UNAUTHORIZED_ERROR = createError(
  "UnauthorizedError",
  "Unauthorized"
);
export const FORBIDDEN_ERROR = createError("ForbiddenError", "Forbidden");
export const NOT_FOUND_ERROR = createError("NotFoundError", "Not Found");
export const CONFLICT_ERROR = createError("ConflictError", "Conflict");
