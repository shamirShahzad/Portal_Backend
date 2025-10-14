import { PoolClient } from "pg";
import { BAD_REQUEST_ERROR, NOT_FOUND_ERROR } from "../../util/Errors";
import { STATUS_CODES } from "../../util/enums";
import crypto from "crypto";

const { BAD_REQUEST, NOT_FOUND, SUCCESS, CREATED, SERVER_ERROR } = STATUS_CODES;

export interface ManagerNotificationData {
  application_id: string;
  manager_email: string;
  manager_name: string;
  applicant_name: string;
  course_title: string;
}

export interface ManagerApprovalData {
  application_id: string;
  token: string;
  manager_approval: boolean;
  manager_notes: string;
  reviewed_at: Date;
}

export const createManagerApprovalToken = async (
  client: PoolClient,
  notificationData: ManagerNotificationData
) => {
  try {
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const qStr = `
      INSERT INTO manager_approval_tokens (
        application_id,
        token,
        manager_email,
        expires_at
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      notificationData.application_id,
      token,
      notificationData.manager_email,
      expiresAt
    ];
    
    const result = await client.query(qStr, values);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: BAD_REQUEST,
        error: BAD_REQUEST_ERROR("Failed to create approval token"),
        errorMessage: "Failed to create approval token"
      };
    }
    
    return {
      success: true,
      data: {
        ...result.rows[0],
        approval_url: `${process.env.FRONTEND_MANAGER_APPROVAL_URL || 'http://localhost:5173/manager-approval'}/${notificationData.application_id}?token=${token}`
      },
      statusCode: CREATED,
      message: "Manager approval token created successfully"
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while creating approval token",
      statusCode: SERVER_ERROR
    };
  }
};

export const verifyManagerApprovalToken = async (
  client: PoolClient,
  applicationId: string,
  token: string
) => {
  try {
    const qStr = `
      SELECT mat.*
      FROM manager_approval_tokens mat
      WHERE mat.application_id = $1 
        AND mat.token = $2 
        AND mat.is_valid = TRUE 
        AND mat.expires_at > NOW()
        AND mat.used_at IS NULL
    `;
    
    const result = await client.query(qStr, [applicationId, token]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: BAD_REQUEST_ERROR("Invalid or expired approval token"),
        errorMessage: "Invalid or expired approval token"
      };
    }
    
    return {
      success: true,
      data: result.rows[0],
      statusCode: SUCCESS,
      message: "Token verified successfully"
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while verifying token",
      statusCode: SERVER_ERROR
    };
  }
};

export const submitManagerApproval = async (
  client: PoolClient,
  approvalData: ManagerApprovalData
) => {
  try {
    // First verify and invalidate the token
    const tokenVerification = await verifyManagerApprovalToken(
      client, 
      approvalData.application_id, 
      approvalData.token
    );
    
    if (!tokenVerification.success) {
      return tokenVerification;
    }
    
    // Invalidate the token
    const invalidateTokenQuery = `
      UPDATE manager_approval_tokens 
      SET is_valid = FALSE, used_at = NOW()
      WHERE application_id = $1 AND token = $2
    `;
    
    await client.query(invalidateTokenQuery, [
      approvalData.application_id,
      approvalData.token
    ]);
    
    // Update the application with manager decision
    const updateApplicationQuery = `
      UPDATE applications 
      SET 
        manager_approval = $1,
        manager_notes = $2,
        manager_reviewed_at = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    
    const updateResult = await client.query(updateApplicationQuery, [
      approvalData.manager_approval,
      approvalData.manager_notes,
      approvalData.reviewed_at,
      approvalData.application_id
    ]);
    
    if (updateResult.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: NOT_FOUND_ERROR("Application not found"),
        errorMessage: "Application not found"
      };
    }
    
    return {
      success: true,
      data: {
        application_id: approvalData.application_id,
        manager_approval: approvalData.manager_approval,
        manager_notes: approvalData.manager_notes,
        reviewed_at: approvalData.reviewed_at,
        token_invalidated: true
      },
      statusCode: SUCCESS,
      message: "Manager approval recorded successfully"
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while recording manager approval",
      statusCode: SERVER_ERROR
    };
  }
};

export const getApplicationForManagerReview = async (
  client: PoolClient,
  applicationId: string,
  token: string
) => {
  try {
    // First verify the token
    const tokenVerification = await verifyManagerApprovalToken(client, applicationId, token);
    
    if (!tokenVerification.success) {
      return tokenVerification;
    }
    
    // Get detailed application information
    const qStr = `
      SELECT 
        a.*,
        up.full_name AS applicant_name,
        up.employee_id,
        up.department,
        up.job_title,
        up.experience_years,
        up.manager_name,
        up.manager_email,
        u.email as applicant_email,
        c.title AS course_title,
        c.category AS course_category,
        c.duration AS course_duration,
        c.format AS course_format,
        c.level AS course_level,
        c.thumbnail_url AS course_thumbnail_url,
        c.price AS course_price
      FROM applications a
      JOIN users u ON a.applicant_id = u.id
      JOIN courses c ON a.course_id = c.id
      JOIN user_profiles up ON a.applicant_id = up.id
      WHERE a.id = $1
    `;
    
    const result = await client.query(qStr, [applicationId]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: NOT_FOUND_ERROR("Application not found"),
        errorMessage: "Application not found"
      };
    }
    
    return {
      success: true,
      data: result.rows[0],
      statusCode: SUCCESS,
      message: "Application details fetched successfully"
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while fetching application details",
      statusCode: SERVER_ERROR
    };
  }
};