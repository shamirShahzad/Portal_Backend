import { PoolClient } from "pg";
import { STATUS_CODES } from "../../util/enums";
import { 
  BAD_REQUEST_ERROR, 
  NOT_FOUND_ERROR, 
  INTERNAL_SERVER_ERROR 
} from "../../util/Errors";

const { BAD_REQUEST, SUCCESS, SERVER_ERROR: SERVER_ERROR_CODE, NOT_FOUND } = STATUS_CODES;

export interface ExportJobData {
  user_id: string;
  name: string;
  data_types: {
    applications?: boolean;
    training?: boolean;
    employees?: boolean;
    courses?: boolean;
  };
  filters: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    organizations?: string[];
    status?: string[];
  };
  format: 'excel' | 'csv' | 'pdf' | 'json';
  scheduling?: {
    type: 'one-time' | 'daily' | 'weekly' | 'monthly';
    schedule?: string;
  };
}

export interface ExportJobUpdate {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  file_path?: string;
  file_size?: number;
  error_message?: string;
  progress?: number;
  completed_at?: Date;
}

export interface ExportJob {
  id: string;
  user_id: string;
  name: string;
  data_types: any;
  filters: any;
  format: string;
  status: string;
  file_path?: string;
  file_size?: number;
  error_message?: string;
  progress: number;
  created_at: string;
  completed_at?: string;
  expires_at: string;
  scheduling: any;
}

export const createExportJob = async (
  client: PoolClient,
  exportData: ExportJobData
) => {
  try {
    const qStr = `
      INSERT INTO export_jobs (
        user_id, name, data_types, filters, format, scheduling
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      exportData.user_id,
      exportData.name,
      JSON.stringify(exportData.data_types),
      JSON.stringify(exportData.filters),
      exportData.format,
      JSON.stringify(exportData.scheduling || { type: 'one-time' })
    ];
    
    const result = await client.query(qStr, values);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: BAD_REQUEST,
        error: BAD_REQUEST_ERROR("Failed to create export job"),
        errorMessage: "Failed to create export job"
      };
    }
    
    return {
      success: true,
      statusCode: SUCCESS,
      data: result.rows[0]
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while creating export job",
      statusCode: SERVER_ERROR_CODE
    };
  }
};

export const getExportJob = async (
  client: PoolClient,
  exportId: string,
  userId?: string
) => {
  try {
    let qStr = `
      SELECT ej.*, u.email as user_email, up.full_name
      FROM export_jobs ej
      JOIN users u ON ej.user_id = u.id
      JOIN user_profiles up ON u.id = up.id
      WHERE ej.id = $1
    `;
    
    const values = [exportId];
    
    // Add user restriction if provided
    if (userId) {
      qStr += ` AND ej.user_id = $2`;
      values.push(userId);
    }
    
    const result = await client.query(qStr, values);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: NOT_FOUND_ERROR("Export job not found"),
        errorMessage: "Export job not found"
      };
    }
    
    return {
      success: true,
      statusCode: SUCCESS,
      data: result.rows[0]
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while fetching export job",
      statusCode: SERVER_ERROR_CODE
    };
  }
};

export const updateExportJob = async (
  client: PoolClient,
  exportId: string,
  updateData: ExportJobUpdate
) => {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    // Build dynamic SET clause
    if (updateData.status !== undefined) {
      setClauses.push(`status = $${paramCount++}`);
      values.push(updateData.status);
    }
    
    if (updateData.file_path !== undefined) {
      setClauses.push(`file_path = $${paramCount++}`);
      values.push(updateData.file_path);
    }
    
    if (updateData.file_size !== undefined) {
      setClauses.push(`file_size = $${paramCount++}`);
      values.push(updateData.file_size);
    }
    
    if (updateData.error_message !== undefined) {
      setClauses.push(`error_message = $${paramCount++}`);
      values.push(updateData.error_message);
    }
    
    if (updateData.progress !== undefined) {
      setClauses.push(`progress = $${paramCount++}`);
      values.push(updateData.progress);
    }
    
    if (updateData.completed_at !== undefined) {
      setClauses.push(`completed_at = $${paramCount++}`);
      values.push(updateData.completed_at);
    }
    
    if (setClauses.length === 0) {
      return {
        success: false,
        statusCode: BAD_REQUEST,
        error: BAD_REQUEST_ERROR("No update data provided"),
        errorMessage: "No update data provided"
      };
    }
    
    const qStr = `
      UPDATE export_jobs 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    values.push(exportId);
    
    const result = await client.query(qStr, values);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: NOT_FOUND_ERROR("Export job not found"),
        errorMessage: "Export job not found"
      };
    }
    
    return {
      success: true,
      statusCode: SUCCESS,
      data: result.rows[0]
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while updating export job",
      statusCode: SERVER_ERROR_CODE
    };
  }
};

export const getExportJobsByUser = async (
  client: PoolClient,
  userId: string,
  page: number = 1,
  limit: number = 10,
  status?: string
) => {
  try {
    const offset = (page - 1) * limit;
    
    let qStr = `
      SELECT ej.*, u.email as user_email, up.full_name
      FROM export_jobs ej
      JOIN users u ON ej.user_id = u.id
      JOIN user_profiles up ON u.id = up.id
      WHERE ej.user_id = $1
    `;
    
    const values = [userId];
    let paramCount = 2;
    
    if (status) {
      qStr += ` AND ej.status = $${paramCount++}`;
      values.push(status);
    }
    
    qStr += ` ORDER BY ej.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    values.push(limit.toString(), offset.toString());
    
    const result = await client.query(qStr, values);
    
    // Get total count for pagination
    let countQStr = `
      SELECT COUNT(*) as total
      FROM export_jobs
      WHERE user_id = $1
    `;
    
    const countValues = [userId];
    if (status) {
      countQStr += ` AND status = $2`;
      countValues.push(status);
    }
    
    const countResult = await client.query(countQStr, countValues);
    const total = parseInt(countResult.rows[0].total);
    
    return {
      success: true,
      statusCode: SUCCESS,
      data: {
        exports: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while fetching export jobs",
      statusCode: SERVER_ERROR_CODE
    };
  }
};

export const deleteExportJob = async (
  client: PoolClient,
  exportId: string,
  userId?: string
) => {
  try {
    let qStr = `DELETE FROM export_jobs WHERE id = $1`;
    const values = [exportId];
    
    // Add user restriction if provided
    if (userId) {
      qStr += ` AND user_id = $2`;
      values.push(userId);
    }
    
    qStr += ` RETURNING *`;
    
    const result = await client.query(qStr, values);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: NOT_FOUND_ERROR("Export job not found or access denied"),
        errorMessage: "Export job not found or access denied"
      };
    }
    
    return {
      success: true,
      statusCode: SUCCESS,
      data: result.rows[0]
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while deleting export job",
      statusCode: SERVER_ERROR_CODE
    };
  }
};

export const getExpiredExportJobs = async (client: PoolClient) => {
  try {
    const qStr = `
      SELECT * FROM export_jobs
      WHERE expires_at < CURRENT_TIMESTAMP
      AND status = 'completed'
      AND file_path IS NOT NULL
    `;
    
    const result = await client.query(qStr);
    
    return {
      success: true,
      statusCode: SUCCESS,
      data: result.rows
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while fetching expired export jobs",
      statusCode: SERVER_ERROR_CODE
    };
  }
};

export const getPendingExportJobs = async (client: PoolClient) => {
  try {
    const qStr = `
      SELECT ej.*, u.email as user_email, up.full_name
      FROM export_jobs ej
      JOIN users u ON ej.user_id = u.id
      JOIN user_profiles up ON u.id = up.id
      WHERE ej.status = 'pending'
      ORDER BY ej.created_at ASC
    `;
    
    const result = await client.query(qStr);
    
    return {
      success: true,
      statusCode: SUCCESS,
      data: result.rows
    };
    
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while fetching pending export jobs",
      statusCode: SERVER_ERROR_CODE
    };
  }
};