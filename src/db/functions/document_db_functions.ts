import { PoolClient } from "pg";
import { Document, DocumentUpdate } from "../../models/documents";
import { BAD_REQUEST_ERROR } from "../../util/Errors";
import { STATUS_CODES } from "../../util/enums";
import { success } from "zod";
const { BAD_REQUEST, NOT_FOUND, SUCCESS, CREATED, SERVER_ERROR } = STATUS_CODES;
export const getDocumentsByApplicationId = async (
  client: PoolClient,
  application_id: string
) => {
  const qStr = `SELECT * FROM documents WHERE application_id = $1`;
  try {
    const result = await client.query(qStr, [application_id]);
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: BAD_REQUEST_ERROR("No documents found for this application"),
        errorMessage: "No documents found for this application",
      };
    }
    return {
      success: true,
      data: result.rows,
      statusCode: SUCCESS,
      message: "Documents fetched successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while fetching documents",
      statusCode: SERVER_ERROR,
    };
  }
};

export const getDocumentById = async (client: PoolClient, id: string) => {
  const qStr = `SELECT * FROM documents WHERE id = $1`;
  try {
    const values = [id];
    const result = await client.query(qStr, values);
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: BAD_REQUEST_ERROR("Document not found"),
        errorMessage: "Document not found",
      };
    }
    return {
      success: true,
      data: result.rows[0],
      statusCode: SUCCESS,
      message: "Document fetched successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while fetching document",
      statusCode: SERVER_ERROR,
    };
  }
};

export const createDocument = async (
  client: PoolClient,
  document: Document
) => {
  const qStr = `
    INSERT INTO documents (
        application_id,
        file_name,
        file_path,
        file_size,
        file_type,
        uploaded_by,
        is_required
    ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7 
    ) RETURNING *
`;

  try {
    const values = [
      document.application_id,
      document.file_name,
      document.file_path,
      document.file_size,
      document.file_type,
      document.uploaded_by,
      document.is_required,
    ];

    const result = await client.query(qStr, values);
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: BAD_REQUEST,
        error: BAD_REQUEST_ERROR("Failed to add documents"),
        errorMessage: "Failed to create documents",
      };
    }
    if (result.rowCount === 0) {
      return {
        success: false,
        errorMessage: "Bad Request",
        error: BAD_REQUEST_ERROR("Bad request"),
        statusCode: BAD_REQUEST,
      };
    }
    return {
      success: true,
      data: result.rows[0],
      statusCode: CREATED,
      message: "Document created succesfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went worng while creatig documents",
      statusCode: SERVER_ERROR,
    };
  }
};

export const updateDocument = async (
  client: PoolClient,
  updateTup: DocumentUpdate
) => {
  const qStr = `
UPDATE documents SET
file_name = COALESCE($1, file_name),
file_path = COALESCE($2, file_path),
is_required = COALESCE($3, is_required)
WHERE id = $4
RETURNING *;
`;
  try {
    const values = [
      updateTup.file_name,
      updateTup.file_path,
      updateTup.is_required,
      updateTup.id,
    ];
    const result = await client.query(qStr, values);
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: BAD_REQUEST_ERROR("Document not found"),
        errorMessage: "Document not found",
      };
    }
    if (result.rowCount === 0) {
      return {
        success: false,
        statusCode: BAD_REQUEST,
        error: BAD_REQUEST_ERROR("Failed to update document"),
        errorMessage: "Failed to update document",
      };
    }
    return {
      success: true,
      data: result.rows[0],
      statusCode: SUCCESS,
      message: "Document updated successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while updating document",
      statusCode: SERVER_ERROR,
    };
  }
};

export const deleteDocument = async (client: PoolClient, id: string) => {
  const qStr = `DELETE FROM documents WHERE id=$1 RETURNING *`;
  try {
    const result = await client.query(qStr, [id]);
    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: NOT_FOUND,
        error: BAD_REQUEST_ERROR("Document not found"),
        errorMessage: "Document not found",
      };
    }
    return {
      success: true,
      data: result.rows[0],
      statusCode: SUCCESS,
      message: "Document deleted successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error,
      errorMessage: "Something went wrong while deleting document",
      statusCode: SERVER_ERROR,
    };
  }
};
