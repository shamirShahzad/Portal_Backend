import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { Response, NextFunction } from "express";
import { STATUS_CODES } from "../util/enums";
import pool from "../db/config";
import { BAD_REQUEST_ERROR, NOT_FOUND_ERROR } from "../util/Errors";
import {
  Document,
  DocumentSchema,
  DocumentUpdateSchema,
} from "../models/documents";
import {
  createDocument,
  deleteDocument,
  getDocumentById,
  getDocumentsByApplicationId,
  updateDocument,
} from "../db/functions/document_db_functions";
import path from "path";
import fs from "fs";
import { getAllApplications } from "../db/functions/application_db_functions";
import { getUserById } from "../db/functions/user_db_functions";
import { fillEmptyObject } from "../util/functions";
const { BAD_REQUEST, NOT_FOUND, CREATED, SUCCESS } = STATUS_CODES;
const documentController = {
  getAllDocuments: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.query;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (id) {
        const documentTup = await getDocumentById(client, id.toString());
        if (!documentTup.success) {
          await client.query("ROLLBACK");
          res.status(NOT_FOUND);
          return next(NOT_FOUND_ERROR("Document not found"));
        }
        return res.status(SUCCESS).json({
          success: true,
          statusCode: SUCCESS,
          message: "Document fetched successfully",
          data: documentTup.data,
        });
      }
      const { application_id } = req.body;
      const documentsTup = await getDocumentsByApplicationId(
        client,
        application_id.toString()
      );
      if (!documentsTup.success) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(documentsTup.error);
      }
      await client.query("COMMIT");
      return res.status(SUCCESS).json({
        success: true,
        message: "Documents fetched successfully",
        statusCode: SUCCESS,
        data: documentsTup.data,
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      return next(err);
    } finally {
      client.release(true);
    }
  },
  createNewDocument: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    const files = req?.files as Express.Multer.File[] | undefined;
    const { application_id, uploaded_by, is_required } = req.body;

    const documents: Document[] = [];
    const addedDocumentsArray: Document[] = [];

    try {
      await client.query("BEGIN");

      const applicationTup = await getAllApplications(client, {
        id: application_id,
      });
      if (!applicationTup.success) {
        return next(applicationTup.error);
      }

      const uploadedByTup = await getUserById(client, uploaded_by);
      if (!uploadedByTup.success) {
        return next(uploadedByTup.error);
      }
      if (files && files.length > 0) {
        for (const file of files) {
          const newFileName = `${file.originalname}-${Date.now()}`;
          const filePath = `uploads/${newFileName}`;

          const singleDocument = {
            application_id,
            file_name: newFileName,
            file_path: filePath,
            file_size: BigInt(file.size),
            file_type: file.mimetype,
            is_required: Boolean(Number(is_required)),
            uploaded_by,
          };

          const parsedDocument = DocumentSchema.parse(singleDocument);
          documents.push(parsedDocument);
        }
      }

      if (documents.length === 0) {
        res.status(BAD_REQUEST);
        return next(BAD_REQUEST_ERROR("No files provided"));
      }

      for (const document of documents) {
        const createTup = await createDocument(client, document);
        if (!createTup.success) {
          await client.query("ROLLBACK");
          res.status(createTup.statusCode);
          return next(createTup.error);
        }
        addedDocumentsArray.push(createTup.data);
      }

      await client.query("COMMIT");

      if (files && files.length > 0) {
        const uploadsDir = path.join(__dirname, "..", "uploads");

        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const document = documents[i];
          const filePath = path.join(uploadsDir, document.file_name);

          fs.writeFileSync(filePath, file.buffer);
        }
      }

      return res.json({
        success: true,
        data: addedDocumentsArray,
      });
    } catch (error: any) {
      await client.query("ROLLBACK");
      return next(error);
    } finally {
      client.release(true);
    }
  },
  updateDocument: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { id } = req.params;
      const existingDocumentTup = await getDocumentById(client, id.toString());
      if (!existingDocumentTup.success) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(NOT_FOUND_ERROR("Document not found"));
      }
      const existingDocument = existingDocumentTup.data;
      const updateTup = req.body;
      if (updateTup.file_name) {
        const newFilName = `${updateTup.file_name}-${Date.now()}`;
        updateTup.file_name = newFilName;
        const path = `uploads/${updateTup.file_name}`;
        updateTup.file_path = path;
      }
      const updatedDocumentData = fillEmptyObject(updateTup, existingDocument);
      const parsedUpdateData = DocumentUpdateSchema.parse(updatedDocumentData);
      const newDocumentTup = await updateDocument(client, parsedUpdateData);
      if (!newDocumentTup.success) {
        await client.query("ROLLBACK");
        res.status(newDocumentTup.statusCode);
        return next(newDocumentTup.error);
      }
      await client.query("COMMIT");
      if (
        updateTup.file_name &&
        existingDocument.file_name !== updateTup.file_name
      ) {
        const uploadDir = path.join(__dirname, "..", "uploads");
        const oldFilePath = path.join(uploadDir, existingDocument.file_name);
        const newFilePath = path.join(uploadDir, updateTup.file_name);
        if (fs.existsSync(oldFilePath)) {
          fs.renameSync(oldFilePath, newFilePath);
        }
      }
      return res.status(SUCCESS).json({
        success: true,
        data: newDocumentTup.data,
        message: "Document updated successfully",
        statusCode: SUCCESS,
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      return next(err);
    }
  },
  deleteDocument: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;
    const client = await pool.connect();
    if (id == undefined || id == null) {
      return next(NOT_FOUND_ERROR("This document does not exist"));
    }
    try {
      await client.query("BEGIN");
      const documentTup = await getDocumentById(client, id.toString());
      if (!documentTup.success) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(NOT_FOUND_ERROR("Document not found"));
      }
      const result = await deleteDocument(client, id.toString());
      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(BAD_REQUEST);
        return next(BAD_REQUEST_ERROR("Failed to delete document"));
      }
      await client.query("COMMIT");
      const uploadDir = path.join(__dirname, "..", "uploads");
      const filePath = path.join(uploadDir, documentTup.data.file_name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(SUCCESS).json({
        success: true,
        message: result.message,
        statusCode: SUCCESS,
        data: {},
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      return next(err);
    }
  },
};

export default documentController;
