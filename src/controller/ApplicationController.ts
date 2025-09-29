import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { STATUS_CODES } from "../util/enums";
import pool from "../db/config";
import { z } from "zod";
import {
  createApplication,
  gettAllApplications,
} from "../db/functions/application_db_functions";
import { ApplicationSchema } from "../models/applications";
const { BAD_REQUEST, SUCCESS, CREATED, NOT_FOUND } = STATUS_CODES;

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

export type FiltersType = z.infer<typeof FiltersSchema>;

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
      const result = await gettAllApplications(client, queryParams);
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
    console.log("HERE");
    try {
      await client.query("BEGIN");
      const body = req.body;
      body.submitted_at = new Date(body.submitted_at);
      const bodyTup = ApplicationSchema.parse(body);
      const createApplicationTup = await createApplication(client, bodyTup);
      if (!createApplicationTup.success) {
        await client.query("ROLLBACK");
        res.status(BAD_REQUEST);
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
      return next(err);
    } finally {
      client.release(true);
    }
  },
};

export default applicationController;
