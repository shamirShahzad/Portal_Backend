import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { STATUS_CODES, application_status } from "../util/enums";
import pool from "../db/config";
import { z } from "zod";
import {
  createManagerApprovalToken,
  verifyManagerApprovalToken,
  submitManagerApproval,
  getApplicationForManagerReview,
  ManagerNotificationData,
  ManagerApprovalData,
} from "../db/functions/manager_approval_db_functions";
import {
  getDetailedApplications,
  updateApplication,
} from "../db/functions/application_db_functions";
import { sendMail } from "../util/email/mailer";
import path from "path";
import fs from "fs";

const { BAD_REQUEST, SUCCESS, CREATED, NOT_FOUND, UNAUTHORIZED } = STATUS_CODES;

// Helper function to add delay between email sends
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ManagerNotificationSchema = z.object({
  manager_email: z.email("Valid manager email is required"),
  manager_name: z.string().min(1, "Manager name is required"),
  applicant_name: z.string().min(1, "Applicant name is required"),
  course_title: z.string().min(1, "Course title is required"),
});

const ManagerApprovalSchema = z.object({
  token: z.string().min(1, "Token is required"),
  manager_approval: z.boolean(),
  manager_notes: z.string().min(1, "Manager notes are required"),
  reviewed_at: z
    .string("Valid ISO datetime is required")
    .transform((val) => new Date(val)),
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

const getManagerConfirmationEmailHtml = (data: {
  manager_name: string;
  applicant_name: string;
  course_title: string;
  decision: boolean;
  manager_notes: string;
  reviewed_date: string;
}) => {
  const filePath = path.join(
    __dirname,
    "..",
    "util",
    "email",
    "ManagerApprovalConfirmationEmail.html"
  );
  let html = fs.readFileSync(filePath, "utf-8");

  const isApproved = data.decision;
  const headerColorStart = isApproved ? "#10b981" : "#ef4444";
  const headerColorEnd = isApproved ? "#059669" : "#dc2626";
  const iconBgColor = isApproved ? "#d1fae5" : "#fee2e2";
  const decisionColor = isApproved ? "#10b981" : "#ef4444";
  const decision = isApproved ? "APPROVED" : "REJECTED";
  const nextStepsMessage = isApproved
    ? "The applicant has been notified of your approval decision and the application will proceed to the next stage."
    : "The applicant has been notified of your rejection decision. They may reapply in the future if circumstances change.";

  const statusIcon = isApproved
    ? `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M9 12l2 2 4-4"></path>
         <circle cx="12" cy="12" r="10"></circle>
       </svg>`
    : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <line x1="18" y1="6" x2="6" y2="18"></line>
         <line x1="6" y1="6" x2="18" y2="18"></line>
         <circle cx="12" cy="12" r="10"></circle>
       </svg>`;

  // Replace placeholders
  html = html.replace(/{{MANAGER_NAME}}/g, data.manager_name);
  html = html.replace(/{{APPLICANT_NAME}}/g, data.applicant_name);
  html = html.replace(/{{COURSE_TITLE}}/g, data.course_title);
  html = html.replace(/{{DECISION}}/g, decision);
  html = html.replace(/{{REVIEWED_DATE}}/g, data.reviewed_date);
  html = html.replace(/{{MANAGER_NOTES}}/g, data.manager_notes);
  html = html.replace(/{{HEADER_COLOR_START}}/g, headerColorStart);
  html = html.replace(/{{HEADER_COLOR_END}}/g, headerColorEnd);
  html = html.replace(/{{ICON_BG_COLOR}}/g, iconBgColor);
  html = html.replace(/{{DECISION_COLOR}}/g, decisionColor);
  html = html.replace(/{{STATUS_ICON}}/g, statusIcon);
  html = html.replace(/{{NEXT_STEPS_MESSAGE}}/g, nextStepsMessage);
  html = html.replace(/{{CURRENT_YEAR}}/g, new Date().getFullYear().toString());

  return html;
};

const getApplicantNotificationEmailHtml = (data: {
  applicant_name: string;
  course_title: string;
  application_id: string;
  decision: boolean;
  manager_name: string;
  manager_notes: string;
  reviewed_date: string;
}) => {
  const filePath = path.join(
    __dirname,
    "..",
    "util",
    "email",
    "ApplicantNotificationEmail.html"
  );
  let html = fs.readFileSync(filePath, "utf-8");

  const isApproved = data.decision;
  const headerColorStart = isApproved ? "#10b981" : "#ef4444";
  const headerColorEnd = isApproved ? "#059669" : "#dc2626";
  const iconBgColor = isApproved ? "#d1fae5" : "#fee2e2";
  const decisionColor = isApproved ? "#10b981" : "#ef4444";
  const decision = isApproved ? "APPROVED" : "REJECTED";
  const statusTitle = isApproved
    ? "Application Approved!"
    : "Application Not Approved";
  const nextStepsBgColor = isApproved ? "#ecfdf5" : "#fef2f2";

  const statusMessage = isApproved
    ? "Great news! Your manager has approved your training application. Your request will now proceed to the next stage of the approval process."
    : "We regret to inform you that your manager has not approved your training application at this time. Please review the feedback below and feel free to discuss with your manager or reapply in the future.";

  const nextStepsMessage = isApproved
    ? "Your application will now be reviewed by the training department. You will receive further communication regarding enrollment details, training schedule, and any additional requirements."
    : "We encourage you to discuss this decision with your manager to understand their concerns. You may address these issues and reapply for training in the future when circumstances are more favorable.";

  const statusIcon = isApproved
    ? `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M9 12l2 2 4-4"></path>
         <circle cx="12" cy="12" r="10"></circle>
       </svg>`
    : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <line x1="18" y1="6" x2="6" y2="18"></line>
         <line x1="6" y1="6" x2="18" y2="18"></line>
         <circle cx="12" cy="12" r="10"></circle>
       </svg>`;

  // Replace placeholders
  html = html.replace(/{{APPLICANT_NAME}}/g, data.applicant_name);
  html = html.replace(/{{COURSE_TITLE}}/g, data.course_title);
  html = html.replace(/{{APPLICATION_ID}}/g, data.application_id);
  html = html.replace(/{{DECISION}}/g, decision);
  html = html.replace(/{{MANAGER_NAME}}/g, data.manager_name);
  html = html.replace(/{{MANAGER_NOTES}}/g, data.manager_notes);
  html = html.replace(/{{REVIEWED_DATE}}/g, data.reviewed_date);
  html = html.replace(/{{HEADER_COLOR_START}}/g, headerColorStart);
  html = html.replace(/{{HEADER_COLOR_END}}/g, headerColorEnd);
  html = html.replace(/{{ICON_BG_COLOR}}/g, iconBgColor);
  html = html.replace(/{{DECISION_COLOR}}/g, decisionColor);
  html = html.replace(/{{STATUS_ICON}}/g, statusIcon);
  html = html.replace(/{{STATUS_TITLE}}/g, statusTitle);
  html = html.replace(/{{STATUS_MESSAGE}}/g, statusMessage);
  html = html.replace(/{{NEXT_STEPS_BG_COLOR}}/g, nextStepsBgColor);
  html = html.replace(/{{NEXT_STEPS_MESSAGE}}/g, nextStepsMessage);
  html = html.replace(/{{CURRENT_YEAR}}/g, new Date().getFullYear().toString());

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
      const applicationResult = await getDetailedApplications(client, {
        id: applicationId,
      });

      if (
        !applicationResult.success ||
        !applicationResult.data ||
        applicationResult.data.length === 0
      ) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(new Error("Application not found"));
      }

      const application = applicationResult.data[0];

      // Create approval token
      const tokenResult = await createManagerApprovalToken(client, {
        application_id: applicationId,
        ...notificationData,
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
        approval_url: tokenResult.data.approval_url,
      });

      await sendMail({
        to: notificationData.manager_email,
        subject: `Action Required: Training Application Approval - ${notificationData.applicant_name}`,
        html: emailHtml,
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
          expires_at: tokenResult.data.expires_at,
        },
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

    if (!token || typeof token !== "string") {
      return res.status(BAD_REQUEST).json({
        success: false,
        statusCode: BAD_REQUEST,
        message: "Token is required",
      });
    }

    try {
      const result = await getApplicationForManagerReview(
        client,
        applicationId,
        token
      );

      if (!result.success) {
        res.status(result.statusCode);
        return next(result.error);
      }

      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        data: result.data,
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

      // Get application details before submitting approval
      const applicationDetailsResult = await getDetailedApplications(client, {
        id: applicationId,
      });

      if (
        !applicationDetailsResult.success ||
        !applicationDetailsResult.data ||
        applicationDetailsResult.data.length === 0
      ) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(new Error("Application not found"));
      }

      const application = applicationDetailsResult.data[0];

      // Submit manager approval
      const result = await submitManagerApproval(client, {
        application_id: applicationId,
        token: approvalData.token,
        manager_approval: approvalData.manager_approval,
        manager_notes: approvalData.manager_notes,
        reviewed_at: approvalData.reviewed_at,
      });

      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(result.statusCode);
        return next(result.error);
      }

      // Update application status only if manager rejected
      let newStatus = null;
      if (!approvalData.manager_approval) {
        // Only update status to rejected if manager rejected
        newStatus = application_status.REJECTED;

        const applicationUpdateResult = await updateApplication(client, {
          id: applicationId,
          applicant_id: application.applicant_id,
          course_id: application.course_id,
          status: newStatus,
          reviewed_at: approvalData.reviewed_at,
          reviewed_by: null, // We don't have manager's UUID, so set to null
          notes: application.notes, // Keep existing notes unchanged
          priority: application.priority,
          submitted_at: application.submitted_at,
          created_at: application.created_at,
          updated_at: new Date(),
        });

        if (!applicationUpdateResult.success) {
          console.error(
            "Failed to update application status:",
            applicationUpdateResult.error
          );
          // Continue with the process even if status update fails
        }
      }
      // If manager approved, do nothing to the application status - it stays as is

      // Send email notifications with delay
      try {
        const reviewedDate = approvalData.reviewed_at.toLocaleDateString();

        // Send confirmation email to manager
        const managerEmailHtml = getManagerConfirmationEmailHtml({
          manager_name: application.manager_name,
          applicant_name: application.applicant_name,
          course_title: application.course_title,
          decision: approvalData.manager_approval,
          manager_notes: approvalData.manager_notes,
          reviewed_date: reviewedDate,
        });

        await sendMail({
          to: application.manager_email,
          subject: `Training Application Decision Confirmation - ${application.applicant_name}`,
          html: managerEmailHtml,
        });

        // Add delay before sending second email (2 seconds)
        await delay(2000);

        // Send notification email to applicant
        const applicantEmailHtml = getApplicantNotificationEmailHtml({
          applicant_name: application.applicant_name,
          course_title: application.course_title,
          application_id: applicationId,
          decision: approvalData.manager_approval,
          manager_name: application.manager_name,
          manager_notes: approvalData.manager_notes,
          reviewed_date: reviewedDate,
        });

        const decisionText = approvalData.manager_approval
          ? "Manager Approval"
          : "Manager Decision";
        await sendMail({
          to: application.applicant_email,
          subject: `Training Application Update: ${decisionText} - ${application.course_title}`,
          html: applicantEmailHtml,
        });
      } catch (emailError) {
        // Log email error but don't fail the transaction
        console.error("Email notification error:", emailError);
        // Continue with success response since the approval was recorded
      }

      await client.query("COMMIT");

      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        message: result.message,
        data: {
          ...result.data,
          emails_sent: true,
          manager_email: application.manager_email,
          applicant_email: application.applicant_email,
          application_status_updated: newStatus || "no change",
          manager_decision: approvalData.manager_approval
            ? "approved"
            : "rejected",
        },
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release(true);
    }
  },
};

export default managerApprovalController;
