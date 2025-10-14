import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { STATUS_CODES } from "../util/enums";
import pool from "../db/config";
import { z } from "zod";
import {
  createManagerApprovalToken,
  verifyManagerApprovalToken,
  submitManagerApproval,
  getApplicationForManagerReview,
  ManagerNotificationData,
  ManagerApprovalData
} from "../db/functions/manager_approval_db_functions";
import { getDetailedApplications } from "../db/functions/application_db_functions";
import { sendMail } from "../util/email/mailer";
import path from "path";
import fs from "fs";

const { BAD_REQUEST, SUCCESS, CREATED, NOT_FOUND, UNAUTHORIZED } = STATUS_CODES;

const ManagerNotificationSchema = z.object({
  manager_email: z.email("Valid manager email is required"),
  manager_name: z.string().min(1, "Manager name is required"),
  applicant_name: z.string().min(1, "Applicant name is required"),
  course_title: z.string().min(1, "Course title is required")
});

const ManagerApprovalSchema = z.object({
  token: z.string().min(1, "Token is required"),
  manager_approval: z.boolean(),
  manager_notes: z.string().min(1, "Manager notes are required"),
  reviewed_at: z.string().datetime("Valid ISO datetime is required")
});

const getManagerApprovalEmailHtml = (data: {
  manager_name: string;
  applicant_name: string;
  course_title: string;
  submitted_date: string;
  approval_url: string;
}) => {
  const filePath = path.join(
    __dirname,
    "..",
    "util",
    "email",
    "ManagerApprovalEmail.html"
  );
  let html = fs.readFileSync(filePath, "utf-8");
  
  // Replace placeholders
  html = html.replace(/{{MANAGER_NAME}}/g, data.manager_name);
  html = html.replace(/{{APPLICANT_NAME}}/g, data.applicant_name);
  html = html.replace(/{{COURSE_TITLE}}/g, data.course_title);
  html = html.replace(/{{SUBMITTED_DATE}}/g, data.submitted_date);
  html = html.replace(/{{APPROVAL_URL}}/g, data.approval_url);
  
  return html;
};

const managerApprovalController = {
  sendManagerNotification: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    const { applicationId } = req.params;
    
    try {
      await client.query("BEGIN");
      
      // Validate request body
      const notificationData = ManagerNotificationSchema.parse(req.body);
      
      // Get application details to verify it exists
      const applicationResult = await getDetailedApplications(client, { id: applicationId });
      
      if (!applicationResult.success || !applicationResult.data || applicationResult.data.length === 0) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(new Error("Application not found"));
      }
      
      const application = applicationResult.data[0];
      
      // Create approval token
      const tokenResult = await createManagerApprovalToken(client, {
        application_id: applicationId,
        ...notificationData
      });
      
      if (!tokenResult.success) {
        await client.query("ROLLBACK");
        res.status(tokenResult.statusCode);
        return next(tokenResult.error);
      }
      
      // Send email notification
      const emailHtml = getManagerApprovalEmailHtml({
        manager_name: notificationData.manager_name,
        applicant_name: notificationData.applicant_name,
        course_title: notificationData.course_title,
        submitted_date: new Date(application.submitted_at).toLocaleDateString(),
        approval_url: tokenResult.data.approval_url
      });
      
      await sendMail({
        to: notificationData.manager_email,
        subject: `Action Required: Training Application Approval - ${notificationData.applicant_name}`,
        html: emailHtml
      });
      
      await client.query("COMMIT");
      
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        message: "Manager notification sent successfully",
        data: {
          email_sent: true,
          manager_email: notificationData.manager_email,
          approval_token: tokenResult.data.token,
          approval_url: tokenResult.data.approval_url,
          expires_at: tokenResult.data.expires_at
        }
      });
      
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release(true);
    }
  },

  getApplicationForReview: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    const { applicationId } = req.params;
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(BAD_REQUEST).json({
        success: false,
        statusCode: BAD_REQUEST,
        message: "Token is required"
      });
    }
    
    try {
      const result = await getApplicationForManagerReview(client, applicationId, token);
      
      if (!result.success) {
        res.status(result.statusCode);
        return next(result.error);
      }
      
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        data: result.data
      });
      
    } catch (err: any) {
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release(true);
    }
  },

  submitManagerApproval: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    const { applicationId } = req.params;
    
    try {
      await client.query("BEGIN");
      
      // Validate request body
      const approvalData = ManagerApprovalSchema.parse(req.body);
      
      // Submit manager approval
      const result = await submitManagerApproval(client, {
        application_id: applicationId,
        token: approvalData.token,
        manager_approval: approvalData.manager_approval,
        manager_notes: approvalData.manager_notes,
        reviewed_at: new Date(approvalData.reviewed_at)
      });
      
      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(result.statusCode);
        return next(result.error);
      }
      
      await client.query("COMMIT");
      
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        message: result.message,
        data: result.data
      });
      
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release(true);
    }
  }
};

export default managerApprovalController;