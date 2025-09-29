import { PoolClient } from "pg";
import { BAD_REQUEST_ERROR, NOT_FOUND_ERROR } from "../../util/Errors";
import { FiltersType } from "../../controller/ApplicationController";
import { Application } from "../../models/applications";
import { getUserById } from "./user_db_functions";
import { getCourseById } from "./course_db_functions";
import { success } from "zod";

export const gettAllApplications = async (
  client: PoolClient,
  filters: FiltersType
) => {
  const conditions = [];
  const values = [];
  let i = 1;
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
    const applicantTup = await getUserById(applicant_id);
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
        submitted_at,
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
            $7,
            $8)
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
        error: BAD_REQUEST_ERROR,
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
