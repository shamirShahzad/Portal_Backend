import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { Response, NextFunction } from "express";
import { STATUS_CODES } from "../util/enums";
import pool from "../db/config";
import { BAD_REQUEST_ERROR, NOT_FOUND_ERROR } from "../util/Errors";
import { Document, DocumentSchema } from "../models/documents";
import {
  createDocument,
  getDocumentById,
  getDocumentsByApplicationId,
} from "../db/functions/document_db_functions";
import path from "path";
import fs from "fs";
import { getAllApplications } from "../db/functions/application_db_functions";
import { getUserById } from "../db/functions/user_db_functions";
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
      const { applicationId } = req.body;
      const documentsTup = await getDocumentsByApplicationId(
        client,
        applicationId.toString()
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
  // createNewDocument: async (
  //   req: AuthenticatedRequest,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   let newDocument: Document;
  //   const client = await pool.connect();
  //   try {
  //     await client.query("BEGIN");
  //     const files = req?.files as Express.Multer.File[];
  //     const { application_id, uploaded_by, is_required } = req.body;
  //     const documents: Array<Document> = [];
  //     const addedDocumentsArray: Array<Document> = [];
  //     if (files) {
  //       for (const file of files) {
  //         const newFileName = `${file.originalname}-${Date.now()}`;
  //         const filePath = `uploads/${newFileName}`;
  //         const singleDocument = {
  //           application_id,
  //           file_name: newFileName,
  //           file_path: filePath,
  //           file_size: BigInt(file.size),
  //           file_type: file.mimetype,
  //           is_required: Boolean(Number(is_required)),
  //           uploaded_by,
  //         };
  //         const parsedDocument = DocumentSchema.parse(singleDocument);
  //         documents.push(parsedDocument);
  //       }
  //     }
  //     if (documents.length < 0) {
  //       res.status(BAD_REQUEST);
  //       return next(BAD_REQUEST_ERROR("Bad request"));
  //     }
  //     for (const document of documents) {
  //       const createTup = await createDocument(client, document);
  //       if (!createTup.success) {
  //         await client.query("ROLLBACK");
  //         res.status(createTup.statusCode);
  //         return next(createTup.error);
  //       }
  //       addedDocumentsArray.push(createTup.data);
  //     }
  //     await client.query("COMMIT");
  //     if(documents){
  //       for(const document of documents){
  //         const filePath = path.join(__dirname,"..","uploads",path.basename(document.file_path))
  //       }
  //     }
  //     return {
  //       success: true,
  //       data: addedDocumentsArray,
  //     };
  //     return res.json({ status: 1 });
  //   } catch (error: any) {
  //     await client.query("ROLLBACK");
  //     return next(error);
  //   } finally {
  //     client.release(true);
  //   }
  // },
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
      // 1️⃣ Parse and validate documents in memory
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

      // 2️⃣ Insert documents into the database
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

      // 3️⃣ Write files to disk after commit
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

      // 4️⃣ Respond with added documents
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
  ) => {},
  deleteDocument: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {},
};

export default documentController;
