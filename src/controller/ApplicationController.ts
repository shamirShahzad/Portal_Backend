import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { STATUS_CODES } from "../util/enums";
import pool from "../db/config";
import { z } from "zod";
import {
  createApplication,
  deleteApplication,
  getAllApplications,
  getDetailedApplications,
  updateApplication,
  bulkUpdateApplications,
} from "../db/functions/application_db_functions";
import {
  Application,
  ApplicationSchema,
  ApplicationUpdateSchema,
} from "../models/applications";
import { BAD_REQUEST_ERROR, NOT_FOUND_ERROR } from "../util/Errors";
import { fillEmptyObject } from "../util/functions";
import { getUserById } from "../db/functions/user_db_functions";
import { getCourseById } from "../db/functions/course_db_functions";
const { BAD_REQUEST, SUCCESS, CREATED, NOT_FOUND, CONFLICT } = STATUS_CODES;

const FiltersSchema = z.object({
  id: z.uuid().optional(),
  applicant_id: z.uuid().optional(),
  course_id: z.uuid().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  reviewed_by: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const BulkUpdateSchema = z.object({
  application_ids: z.array(z.uuid()).min(1, "At least one application ID is required"),
  status: z.string().min(1, "Status is required"),
  notes: z.string().min(1, "Notes are required"),
  reviewed_by: z.uuid("Valid reviewer ID is required"),
  reviewed_at: z.string().datetime("Valid ISO datetime is required"),
});

export type FiltersType = z.infer<typeof FiltersSchema>;
export type BulkUpdateType = z.infer<typeof BulkUpdateSchema>;

const applicationController = {
  getApplications: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    await client.query("BEGIN");
    try {
      const queryParams = FiltersSchema.parse(req.query);
      const result = await getAllApplications(client, queryParams);
      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(
          result.errorMessage === "Application not found"
            ? NOT_FOUND
            : BAD_REQUEST
        );
        return next(result.error);
      }
      await client.query("COMMIT");
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        message: "Applications fetched successfully.",
        data: result.data,
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      return next(err);
    } finally {
      client.release(true);
    }
  },
  createApplication: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const body = req.body;
      if (body.reviewed_at) {
        body.reviewed_at = new Date(body.reviewed_at);
      }
      const bodyTup = ApplicationSchema.parse(body);
      const createApplicationTup = await createApplication(client, bodyTup);
      if (!createApplicationTup.success) {
        await client.query("ROLLBACK");
        // Check if it's a duplicate application error
        const statusCode = createApplicationTup.errorMessage === "You have already applied for this course." 
          ? CONFLICT 
          : BAD_REQUEST;
        res.status(statusCode);
        return next(createApplicationTup.error);
      }
      await client.query("COMMIT");
      res.status(CREATED).json({
        success: true,
        data: createApplicationTup.data,
        statusCode: CREATED,
        message: "Application created succesfully.",
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release(true);
    }
  },
  updateApplication: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    const { id } = req.params;
    if (id == undefined || id == null) {
      return next(NOT_FOUND_ERROR("Application not found"));
    }
    try {
      await client.query("BEGIN");
      const oldTup = await getAllApplications(client, { id });
      if (!oldTup.success) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(NOT_FOUND_ERROR("Aplication not found"));
      }
      let oldTupData: Application;
      if (!oldTup.data) {
        res.status(NOT_FOUND);
        return next(new Error("Data is not present."));
      }
      oldTupData = ApplicationSchema.parse(oldTup.data[0]);
      const updateTup = req.body;
      const applicantTup = await getUserById(client, oldTupData.applicant_id);
      if (!applicantTup.success) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(applicantTup.error);
      }
      const courseTup = await getCourseById(client, oldTupData.course_id);
      if (!courseTup.success) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(courseTup.error);
      }
      const filledUpdateTup = fillEmptyObject(updateTup, oldTupData);

      const application = ApplicationUpdateSchema.parse(filledUpdateTup);
      const updatedTup = await updateApplication(client, application);
      if (!updatedTup.success) {
        await client.query("ROLLBACK");
        res.status(
          updatedTup.errorMessage == "Application not found"
            ? NOT_FOUND
            : BAD_REQUEST
        );
        return next(updatedTup.error);
      }
      await client.query("COMMIT");
      return res.status(SUCCESS).json({
        success: true,
        data: updatedTup.data,
        message: "Application updated successfully",
        statusCode: SUCCESS,
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      return next(err);
    }
  },
  deleteApplication: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;
    const client = await pool.connect();
    if (id == undefined || id == null) {
      return next(NOT_FOUND_ERROR);
    }
    try {
      await client.query("BEGIN");
      const applicationTup = await getAllApplications(client, { id });
      if (!applicationTup.success) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(NOT_FOUND_ERROR);
      }
      const result = await deleteApplication(client, id.toString());
      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(BAD_REQUEST);
        return next(BAD_REQUEST_ERROR);
      }
      await client.query("COMMIT");
      return res.status(SUCCESS).json({
        success: true,
        message: result.message,
        statusCode: SUCCESS,
        data: {},
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(NOT_FOUND);
      return next(NOT_FOUND_ERROR);
    }
  },
  getDetailedApplications: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    await client.query("BEGIN");
    try {
      const queryParams = FiltersSchema.parse(req.query);
      const result = await getDetailedApplications(client, queryParams);
      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(
          result.errorMessage === "Application not found"
            ? NOT_FOUND
            : BAD_REQUEST
        );

        return next(result.error);
      }
      await client.query("COMMIT");
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        message: "Detailed applications fetched successfully",
        data: result.data,
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      return next(err);
    } finally {
      client.release(true);
    }
  },
  bulkUpdateApplications: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      // Validate request body
      const bulkUpdateData = BulkUpdateSchema.parse(req.body);
      
      // Convert reviewed_at string to Date
      const bulkUpdateWithDate = {
        ...bulkUpdateData,
        reviewed_at: new Date(bulkUpdateData.reviewed_at)
      };
      
      const result = await bulkUpdateApplications(client, bulkUpdateWithDate);
      
      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(BAD_REQUEST);
        return next(result.error);
      }
      
      await client.query("COMMIT");
      
      // Determine response based on success/failure ratio
      const { updated_count, failed_count } = result.data!;
      const isPartialSuccess = failed_count > 0 && updated_count > 0;
      const isCompleteFailure = failed_count > 0 && updated_count === 0;
      
      let message = "Bulk update completed successfully";
      
      if (isCompleteFailure) {
        await client.query("ROLLBACK");
        return res.status(BAD_REQUEST).json({
          success: false,
          statusCode: BAD_REQUEST,
          message: "All applications failed to update",
          data: result.data,
        });
      } else if (isPartialSuccess) {
        message = "Bulk update completed with some failures";
      }
      
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        message: message,
        data: result.data,
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

export default applicationController;
