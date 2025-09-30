import { PoolClient } from "pg";
import { Document } from "../../models/documents";
import { BAD_REQUEST_ERROR } from "../../util/Errors";
import { STATUS_CODES } from "../../util/enums";
import { success } from "zod";
const { BAD_REQUEST, NOT_FOUND, SUCCESS, CREATED, SERVER_ERROR } = STATUS_CODES;
export const getDocumentsByApplicationId = async (
  client: PoolClient,
  id: string
) => {
  return {
    success: false,
    data: {},
    error: null,
    errorMessage: "",
    statusCode: "",
  };
};

export const getDocumentById = async (client: PoolClient, id: string) => {
  return {
    success: false,
    data: {},
    error: null,
    errorMessage: "",
    statusCode: "",
  };
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
