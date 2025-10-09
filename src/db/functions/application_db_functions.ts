import { Pool, PoolClient } from "pg";
import { BAD_REQUEST_ERROR, NOT_FOUND_ERROR } from "../../util/Errors";
import { FiltersType } from "../../controller/ApplicationController";
import { Application, ApplicationUpdate } from "../../models/applications";
import { getUserById } from "./user_db_functions";
import { getCourseById } from "./course_db_functions";
import { success } from "zod";
import { error } from "console";

export const getAllApplications = async (
  client: PoolClient,
  filters: FiltersType
) => {
  const conditions = [];
  const values = [];
  let i = 1;
  if (filters.id) {
    conditions.push(`id = $${i++}`);
    values.push(filters.id);
  }
  if (filters.applicant_id) {
    conditions.push(`applicatnt_id = $${i++}`);
    values.push(filters.applicant_id);
  }
  if (filters.course_id) {
    conditions.push(`course_id = $${i++}`);
    values.push(filters.course_id);
  }
  if (filters.status) {
    conditions.push(`status = $${i++}`);
    values.push(filters.status);
  }
  if (filters.priority) {
    conditions.push(`priority = $${i++}`);
    values.push(filters.priority);
  }
  if (filters.reviewed_by) {
    conditions.push(`reviewed_by = $${i++}`);
    values.push(filters.reviewed_by);
  }
  if (filters.from) {
    conditions.push(`created_at >= $${i++}`);
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`created_at <= $${i++}`);
    values.push(filters.to);
  }
  if (filters.from && filters.to) {
    conditions.push(`created_at BETWEEN $${i++} AND $${i++}`);
    values.push(filters.from);
    values.push(filters.to);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const qStr = `SELECT * FROM applications ${whereClause} ORDER BY created_at DESC`;
  try {
    const applicationsTup = await client.query(qStr, values);
    if (applicationsTup.rows.length <= 0 || applicationsTup.rowCount == 0) {
      return {
        success: false,
        errorMessage: "Application not found",
        error: NOT_FOUND_ERROR,
      };
    }
    return {
      success: true,
      data: applicationsTup.rows,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while getting applications.",
      error,
    };
  }
};

export const createApplication = async (
  client: PoolClient,
  applicationTup: Application
) => {
  const {
    applicant_id,
    course_id,
    status,
    priority,
    submitted_at,
    reviewed_at,
    reviewed_by,
    notes,
    created_at,
  } = applicationTup;
  try {
    const applicantTup = await getUserById(client, applicant_id);
    if (!applicantTup.success) {
      return applicantTup;
    }
    const courseTup = await getCourseById(client, course_id);
    if (!courseTup.success) {
      return courseTup;
    }
    const qStr = `INSERT INTO applications (
        applicant_id,
        course_id,
        status,
        priority,
        reviewed_at,
        reviewed_by,
        notes
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
            )
        RETURNING *`;
    const values = [
      applicant_id,
      course_id,
      status,
      priority,
      submitted_at,
      reviewed_at,
      reviewed_by,
      notes,
    ];
    const applicationCreationTup = await client.query(qStr, values);
    if (applicationCreationTup.rowCount == 0) {
      return {
        success: false,
        errorMessage: "Something went wrong while creating application.",
        error: BAD_REQUEST_ERROR("Bad application creation request."),
      };
    }
    return {
      success: true,
      data: applicationCreationTup.rows[0],
    };
  } catch (err: any) {
    return {
      success: false,
      errorMessage: "Something went wrong while creating an application.",
      error: err,
    };
  }
};

export const updateApplication = async (
  client: PoolClient,
  applicationTup: ApplicationUpdate
) => {
  const {
    id,
    applicant_id,
    course_id,
    status,
    priority,
    submitted_at,
    reviewed_at,
    reviewed_by,
    notes,
  } = applicationTup;

  try {
    // Update the application
    const qStr = `
      UPDATE applications SET
        applicant_id = $1,
        course_id = $2,
        status = $3,
        priority = $4,
        submitted_at = $5,
        reviewed_at = $6,
        reviewed_by = $7,
        notes = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *`;

    const values = [
      applicant_id,
      course_id,
      status,
      priority,
      submitted_at,
      reviewed_at,
      reviewed_by,
      notes,
      id,
    ];

    const applicationUpdateTup = await client.query(qStr, values);

    if (applicationUpdateTup.rowCount === 0) {
      return {
        success: false,
        errorMessage: "Something went wrong while updating application.",
        error: BAD_REQUEST_ERROR("Bad application updation request"),
      };
    }

    return {
      success: true,
      data: applicationUpdateTup.rows[0],
    };
  } catch (err: any) {
    return {
      success: false,
      errorMessage: "Something went wrong while updating an application.",
      error: err,
    };
  }
};

export const deleteApplication = async (client: PoolClient, id: string) => {
  const qStr = `DELETE FROM applications WHERE id=$1`;
  try {
    const result = await client.query(qStr, [id]);
    if (result.rowCount === 0) {
      return {
        success: false,
        errorMessage: "Application not found",
        error: NOT_FOUND_ERROR("Application not found"),
      };
    }
    return {
      success: true,
      message: "Application deleted successfully",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err,
      errorMessage: "Something went wrong while deleting this application",
    };
  }
};

export const getDetailedApplications = async (client: PoolClient) => {
  const qStr = `
  SELECT 
    a.*,
    up.full_name AS applicant_name,
    up.employee_id,
    up.department,
    up.sub_organization,
    up.job_title,
    up.experience_years,
    up.manager_name,
    up.manager_email,
    u.email as applicant_email,
    c.title AS course_title,
    c.category AS course_category,
    c.duration AS course_duration,
    c.format AS course_format,
    c.level AS course_level
    FROM applications a
    JOIN users u ON a.applicant_id = u.id
    JOIN courses c ON a.course_id = c.id
    JOIN user_profiles up ON a.applicant_id = up.id
    ORDER BY a.created_at DESC
    LIMIT 20
  `;
  try {
    const applicationsTup = await client.query(qStr);
    if (applicationsTup.rows.length <= 0 || applicationsTup.rowCount == 0) {
      return {
        success: false,
        errorMessage: "Application not found",
        error: NOT_FOUND_ERROR,
      };
    }
    return {
      success: true,
      data: applicationsTup.rows,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while getting applications.",
      error,
    };
  }
};
