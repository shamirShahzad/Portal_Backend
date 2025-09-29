import type { NextFunction, Request, Response } from "express";
import { type User, UserSchema } from "../models/users";
import { z } from "zod";
import { UserProfileSchema, type UserProfile } from "../models/user_profiles";
import bcrypt from "bcrypt";
import {
  createUserProfile,
  getUserByEmail,
  regsiterUser,
  setConfirmedAt,
  setUserConfirmationSentAt,
} from "../db/functions/user_db_functions";

import { STATUS_CODES, user_role } from "../util/enums";
import pool from "../db/config";
import { sendMail } from "../util/email/mailer";
import jwt from "jsonwebtoken";
import type { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import path from "path";
const { BAD_REQUEST, SERVER_ERROR, CREATED, SUCCESS, UNAUTHORIZED, FORBIDDEN } =
  STATUS_CODES;
import fs from "fs";

const userRegistrationSchema = z.object({
  user: z.object({
    email: z.email(),
    password: z.string().min(8),
    confirmation_token: z.string().optional().nullable(),
  }),
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
});

const getConfirmationEmailHtml = (email: string, token: string) => {
  const confirmUrl = `${
    process.env.APP_BASE_URL || "http://localhost:3000"
  }/api/v1/users/auth/confirm?token=${encodeURIComponent(
    token
  )}&email=${encodeURIComponent(email)}`;
  const filePath = path.join(
    __dirname,
    "..",
    "util",
    "email",
    "ConfirmationEmail.html"
  );
  let html = fs.readFileSync(filePath, "utf-8");
  html = html.replace("{{CONFIRMATION_LINK}}", confirmUrl);
  html = html.replace("{{CONFIRMATION_LINK}}", confirmUrl);

  return html;
};

const userController = {
  register: async (req: Request, res: Response, next: NextFunction) => {
    let newUserTup: User;
    let newUserProfileTup: UserProfile;
    const client = await pool.connect();
    try {
      //Get Data from request body and validate
      const parsedData = userRegistrationSchema.parse(req.body);
      //Separate data into user and user profile data
      const { user, ...profileData } = parsedData;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      user.password = hashedPassword;
      //Generate confirmation token
      const confirmationToken = await bcrypt.hash(
        user.email + Date.now().toString(),
        salt
      );
      user.confirmation_token = confirmationToken;
      newUserTup = UserSchema.parse(user);
      await client.query("BEGIN");
      //Create User and get the id and confirmation token
      const result = await regsiterUser(client, newUserTup);
      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(STATUS_CODES.BAD_REQUEST);
        return next(result.error);
      }
      //Create user Profile data using the same client
      newUserProfileTup = UserProfileSchema.parse(profileData);
      newUserProfileTup.id = result.data.id;
      const profileResult = await createUserProfile(client, newUserProfileTup);
      if (!profileResult.success) {
        await client.query("ROLLBACK");
        res.status(STATUS_CODES.BAD_REQUEST);
        return next(profileResult.error);
      }
      // Send confirmation email
      await sendMail({
        to: user.email,
        subject: "Confirm your account",
        html: getConfirmationEmailHtml(user.email, confirmationToken),
      });
      const resultConfirmationSentAt = await setUserConfirmationSentAt(
        client,
        result.data.id
      );
      if (!resultConfirmationSentAt.success) {
        await client.query("ROLLBACK");
        res.status(STATUS_CODES.SERVER_ERROR);
        return next(new Error("Failed to set confirmation_sent_at"));
      }
      await client.query("COMMIT");
      res.status(STATUS_CODES.CREATED).json({
        success: true,
        message:
          "User registered successfully. Please check your email to confirm your account.",
        data: {
          userId: result.data.id,
          confirmationToken: result.data.confirmation_token,
          userProfile: profileResult.data,
        },
      });
    } catch (validationError) {
      res.status(STATUS_CODES.BAD_REQUEST);
      return next(validationError);
    } finally {
      client.release(true);
    }
  },

  confirm: async (req: Request, res: Response, next: NextFunction) => {
    const { token, email } = req.query;
    if (!token || !email) {
      return res
        .status(BAD_REQUEST)
        .json({ success: false, message: "Missing token or email." });
    }
    const client = await pool.connect();
    try {
      const user = await getUserByEmail(client, email as string);
      if (!user.success) {
        return res.status(BAD_REQUEST).json({
          success: false,
          message: "Invalid or expired confirmation token.",
        });
      }
      const sentAt = user?.data?.confirmation_sent_at;
      if (
        !sentAt ||
        Date.now() - new Date(sentAt).getTime() > 24 * 60 * 60 * 1000
      ) {
        return res.status(BAD_REQUEST).json({
          success: false,
          message: "Confirmation token has expired. Please request a new one.",
        });
      }
      const result = await setConfirmedAt(client, email as string);
      if (!result.success) {
        return res.status(BAD_REQUEST).json({
          success: false,
          message: "Invalid or expired confirmation token.",
        });
      }
      return res.status(SUCCESS).json({
        success: true,
        message: "Email confirmed successfully. You can now log in.",
      });
    } catch (error) {
      return next(error);
    } finally {
      client.release();
    }
  },

  login: async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(BAD_REQUEST)
        .json({ success: false, message: "Email and password are required." });
    }
    const client = await pool.connect();
    try {
      const result = await getUserByEmail(client, email);
      if (!result.success) {
        return res.status(UNAUTHORIZED).json({
          success: false,
          message: "Invalid credentials.",
        });
      }
      const user = result.data;
      if (user.confirmation_token) {
        return res.status(FORBIDDEN).json({
          success: false,
          message: "Please confirm your email before logging in.",
        });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(UNAUTHORIZED).json({
          success: false,
          message: "Invalid credentials.",
        });
      }
      const token = jwt.sign(
        {
          id: user?.id,
        },
        process.env.JWT_SECRET!,
        {
          expiresIn: "3d",
        }
      );
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
      });

      return res.status(SUCCESS).json({
        success: true,
        message: "Login successful.",
        token,
      });
    } catch (error) {
      return next(error);
    } finally {
      client.release(true);
    }
  },
  authCheck: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    res
      .status(SUCCESS)
      .json({ success: true, message: "Authenticated", user: req.user });
  },
  logout: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    req.user = null;
    res.cookie("token", "", { maxAge: 0 });
    res.status(SUCCESS).json({
      success: true,
      message: "Logged out successfully",
    });
  },
};

export default userController;
