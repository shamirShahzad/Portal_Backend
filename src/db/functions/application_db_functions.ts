import { Pool, PoolClient } from "pg";
import {
  BAD_REQUEST_ERROR,
  NOT_FOUND_ERROR,
  CONFLICT_ERROR,
} from "../../util/Errors";
import { STATUS_CODES } from "../../util/enums";
import { FiltersType } from "../../controller/ApplicationController";
import { Application, ApplicationUpdate } from "../../models/applications";
import { getUserById } from "./user_db_functions";
import { getCourseById } from "./course_db_functions";
import { getDocumentsByApplicationId } from "./document_db_functions";

const { SUCCESS, NOT_FOUND, SERVER_ERROR } = STATUS_CODES;
import { application_status } from "../../util/enums";

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
    conditions.push(`applicant_id = $${i++}`);
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
  if (filters.from && filters.to) {
    conditions.push(`created_at BETWEEN $${i++} AND $${i++}`);
    values.push(filters.from);
    values.push(filters.to);
  } else {
    if (filters.from) {
      conditions.push(`created_at >= $${i++}`);
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`created_at <= $${i++}`);
      values.push(filters.to);
    }
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

    // Check if user has already applied for this course and it's not rejected or cancelled
    const existingApplicationQuery = `
      SELECT id, status FROM applications 
      WHERE applicant_id = $1 AND course_id = $2 AND status NOT IN ($3, $4)
    `;
    const existingApplication = await client.query(existingApplicationQuery, [
      applicant_id,
      course_id,
      application_status.REJECTED,
      application_status.CANCELLED,
    ]);

    if (existingApplication.rows.length > 0) {
      const existingStatus = existingApplication.rows[0].status;
      return {
        success: false,
        errorMessage: `You have already applied for this course. Current application status: ${existingStatus}. You can only reapply if your previous application was rejected or cancelled.`,
        error: CONFLICT_ERROR(
          "Duplicate application: User has already applied for this course and it's not rejected or cancelled"
        ),
      };
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

// Enhanced function for export with comprehensive filtering
export const getDetailedApplicationsForExport = async (
  client: PoolClient,
  filters: any
) => {
  const conditions = [];
  const values = [];
  let i = 1;
  
  // Basic filters
  if (filters.id) {
    conditions.push(`a.id = $${i++}`);
    values.push(filters.id);
  }
  if (filters.applicant_id) {
    conditions.push(`a.applicant_id = $${i++}`);
    values.push(filters.applicant_id);
  }
  if (filters.course_id) {
    conditions.push(`a.course_id = $${i++}`);
    values.push(filters.course_id);
  }
  
  // Status filtering (support for multiple statuses)
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      const placeholders = filters.status.map(() => `$${i++}`).join(', ');
      conditions.push(`a.status IN (${placeholders})`);
      values.push(...filters.status);
    } else {
      conditions.push(`a.status = $${i++}`);
      values.push(filters.status);
    }
  }
  
  // Priority filtering (support for multiple priorities)
  if (filters.priority) {
    if (Array.isArray(filters.priority)) {
      const placeholders = filters.priority.map(() => `$${i++}`).join(', ');
      conditions.push(`a.priority IN (${placeholders})`);
      values.push(...filters.priority);
    } else {
      conditions.push(`a.priority = $${i++}`);
      values.push(filters.priority);
    }
  }
  
  // Department filtering
  if (filters.department && filters.department.length > 0) {
    const placeholders = filters.department.map(() => `$${i++}`).join(', ');
    conditions.push(`up.department IN (${placeholders})`);
    values.push(...filters.department);
  }
  
  // Sub-organization filtering
  if (filters.subOrganization && filters.subOrganization.length > 0) {
    const placeholders = filters.subOrganization.map(() => `$${i++}`).join(', ');
    conditions.push(`up.sub_organization IN (${placeholders})`);
    values.push(...filters.subOrganization);
  }
  
  // Course category filtering
  if (filters.courseCategories && filters.courseCategories.length > 0) {
    const placeholders = filters.courseCategories.map(() => `$${i++}`).join(', ');
    conditions.push(`c.category IN (${placeholders})`);
    values.push(...filters.courseCategories);
  }
  
  // Specific course ID filtering
  if (filters.courseIds && filters.courseIds.length > 0) {
    const placeholders = filters.courseIds.map(() => `$${i++}`).join(', ');
    conditions.push(`c.id IN (${placeholders})`);
    values.push(...filters.courseIds);
  }
  
  // Reviewer filtering
  if (filters.reviewedBy) {
    if (Array.isArray(filters.reviewedBy)) {
      const placeholders = filters.reviewedBy.map(() => `$${i++}`).join(', ');
      conditions.push(`a.reviewed_by IN (${placeholders})`);
      values.push(...filters.reviewedBy);
    } else {
      conditions.push(`a.reviewed_by = $${i++}`);
      values.push(filters.reviewedBy);
    }
  }
  
  // Dynamic date filtering based on selected field
  const dateField = filters.dateField || 'created_at';
  if (filters.startDate && filters.endDate) {
    conditions.push(`a.${dateField} BETWEEN $${i++} AND $${i++}`);
    values.push(filters.startDate, filters.endDate);
  } else {
    if (filters.startDate) {
      conditions.push(`a.${dateField} >= $${i++}`);
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`a.${dateField} <= $${i++}`);
      values.push(filters.endDate);
    }
  }
  
  // Text search across multiple fields
  if (filters.textSearch) {
    const searchTerm = `%${filters.textSearch.toLowerCase()}%`;
    conditions.push(`(
      LOWER(up.full_name) LIKE $${i++} OR
      LOWER(up.employee_id) LIKE $${i++} OR
      LOWER(c.title) LIKE $${i++} OR
      LOWER(c.category) LIKE $${i++} OR
      LOWER(a.notes) LIKE $${i++}
    )`);
    values.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }
  
  // Exclude inactive courses if specified
  if (filters.excludeInactive) {
    conditions.push(`c.is_active = true`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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
    c.level AS course_level,
    c.thumbnail_url AS course_thumbnail_url,
    c.price AS course_price,
    c.is_tamkeen_support AS course_is_tamkeen_support,
    rev_up.full_name AS reviewer_name
    FROM applications a
    JOIN users u ON a.applicant_id = u.id
    JOIN courses c ON a.course_id = c.id
    JOIN user_profiles up ON a.applicant_id = up.id
    LEFT JOIN user_profiles rev_up ON a.reviewed_by = rev_up.id
    ${whereClause}
    ORDER BY a.${dateField} DESC
  `;
  
  try {
    const applicationsTup = await client.query(qStr, values);
    if (applicationsTup.rows.length <= 0 || applicationsTup.rowCount == 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: NOT_FOUND_ERROR("Applications not found"),
        errorMessage: "Applications not found"
      };
    }
    return {
      success: true,
      statusCode: SUCCESS,
      data: applicationsTup.rows
    };
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while fetching Applications",
      statusCode: SERVER_ERROR
    };
  }
};

export const getDetailedApplications = async (
  client: PoolClient,
  filters: FiltersType
) => {
  const conditions = [];
  const values = [];
  let i = 1;
  if (filters.id) {
    conditions.push(`a.id = $${i++}`);
    values.push(filters.id);
  }
  if (filters.applicant_id) {
    conditions.push(`a.applicant_id = $${i++}`);
    values.push(filters.applicant_id);
  }
  if (filters.course_id) {
    conditions.push(`a.course_id = $${i++}`);
    values.push(filters.course_id);
  }
  if (filters.status) {
    conditions.push(`a.status = $${i++}`);
    values.push(filters.status);
  }
  if (filters.priority) {
    conditions.push(`a.priority = $${i++}`);
    values.push(filters.priority);
  }
  if (filters.reviewed_by) {
    conditions.push(`a.reviewed_by = $${i++}`);
    values.push(filters.reviewed_by);
  }
  if (filters.from && filters.to) {
    conditions.push(`a.created_at BETWEEN $${i++} AND $${i++}`);
    values.push(filters.from);
    values.push(filters.to);
  } else {
    if (filters.from) {
      conditions.push(`a.created_at >= $${i++}`);
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`a.created_at <= $${i++}`);
      values.push(filters.to);
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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
    c.level AS course_level,
    c.thumbnail_url AS course_thumbnail_url,
    c.price AS course_price,
    c.is_tamkeen_support AS course_is_tamkeen_support
    FROM applications a
    JOIN users u ON a.applicant_id = u.id
    JOIN courses c ON a.course_id = c.id
    JOIN user_profiles up ON a.applicant_id = up.id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT 20
  `;
  try {
    const applicationsTup = await client.query(qStr, values);
    if (applicationsTup.rows.length <= 0 || applicationsTup.rowCount == 0) {
      return {
        success: false,
        errorMessage: "Application not found",
        error: NOT_FOUND_ERROR,
      };
    }

    // Fetch documents for each application
    const applicationsWithDocuments = await Promise.all(
      applicationsTup.rows.map(async (application) => {
        try {
          const documentsResult = await getDocumentsByApplicationId(
            client,
            application.id
          );
          return {
            ...application,
            documents: documentsResult.success ? documentsResult.data : [],
          };
        } catch (error) {
          // If documents query fails, return application without documents
          return {
            ...application,
            documents: [],
          };
        }
      })
    );

    return {
      success: true,
      data: applicationsWithDocuments,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while getting applications.",
      error,
    };
  }
};

export const bulkUpdateApplications = async (
  client: PoolClient,
  bulkUpdateData: {
    application_ids: string[];
    status: string;
    notes: string;
    reviewed_by: string;
    reviewed_at: Date;
  }
) => {
  const { application_ids, status, notes, reviewed_by, reviewed_at } =
    bulkUpdateData;
  const updated_applications = [];
  const failed_applications = [];

  try {
    for (const app_id of application_ids) {
      try {
        // Check if application exists and is in submitted status
        const checkQuery = `
          SELECT id, status FROM applications 
          WHERE id = $1
        `;
        const checkResult = await client.query(checkQuery, [app_id]);

        if (checkResult.rows.length === 0) {
          failed_applications.push({
            id: app_id,
            error: "Application not found",
          });
          continue;
        }

        // Update the application
        const updateQuery = `
          UPDATE applications 
          SET status = $1, notes = $2, reviewed_by = $3, reviewed_at = $4, updated_at = NOW()
          WHERE id = $5
          RETURNING id, status, updated_at
        `;

        const updateResult = await client.query(updateQuery, [
          status,
          notes,
          reviewed_by,
          reviewed_at,
          app_id,
        ]);

        if (updateResult.rowCount && updateResult.rowCount > 0) {
          updated_applications.push({
            id: app_id,
            status: status,
            updated_at: updateResult.rows[0].updated_at,
          });
        } else {
          failed_applications.push({
            id: app_id,
            error: "Failed to update application",
          });
        }
      } catch (error: any) {
        failed_applications.push({
          id: app_id,
          error: error.message || "Unknown error occurred",
        });
      }
    }

    return {
      success: true,
      data: {
        updated_count: updated_applications.length,
        failed_count: failed_applications.length,
        updated_applications,
        failed_applications,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error,
      errorMessage: "Something went wrong during bulk update",
    };
  }
};
