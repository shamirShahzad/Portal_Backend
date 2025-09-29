import type { NextFunction, Response, Request } from "express";
import { STATUS_CODES } from "../util/enums";
const { UNAUTHORIZED } = STATUS_CODES;
import jwt from "jsonwebtoken";
import { getUserById } from "../db/functions/user_db_functions";
import type { AuthenticatedRequest } from "../types/AuthenticatedRequest";

export const isAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.cookies.token) {
    res.status(UNAUTHORIZED);
    return next(new Error("Unauthorized: No token provided"));
  }
  const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET!) as {
    id: string;
  };

  const user = await getUserById(decoded.id);
  if (!user.success) {
    res.status(UNAUTHORIZED);
    return next(new Error("Unauthorized: Invalid token"));
  }
  req.user = user.data;
  return next();
};
