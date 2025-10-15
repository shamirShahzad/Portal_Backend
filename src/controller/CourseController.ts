import { NextFunction, Request, Response } from "express";
import pool from "../db/config";
import {
  createCourse,
  deleteCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
} from "../db/functions/course_db_functions";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import {
  Course,
  CourseSchema,
  CourseUpdate,
  CourseUpdateSchema,
} from "../models/courses";
import path from "path";
import fs, { Stats } from "fs";
import { BAD_REQUEST_ERROR, NOT_FOUND_ERROR } from "../util/Errors";
import { STATUS_CODES } from "../util/enums";
import { buffer } from "stream/consumers";
import { success } from "zod";
import { fillEmptyObject } from "../util/functions";
const { BAD_REQUEST, NOT_FOUND, SUCCESS } = STATUS_CODES;

const courseController = {
  getCourse: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.query;
    const client = await pool.connect();
    
    try {
      if (id) {
        // Get single course by ID
        const courseTup = await getCourseById(client, id.toString());
        if (!courseTup.success) {
          res.status(NOT_FOUND);
          return next(courseTup.error);
        }
        return res.status(SUCCESS).json({
          success: true,
          data: courseTup.data,
          message: "Course fetched successfully",
        });
      }
      
      // Get all courses if no ID provided
      const courses = await getAllCourses(client);
      if (!courses.success) {
        res.status(NOT_FOUND);
        return next(courses.error);
      }
      res.status(SUCCESS).json({
        success: true,
        data: courses.data,
        message: "Courses fetched successfully",
      });
    } catch (err: any) {
      res.status(500);
      return next(err);
    } finally {
      client.release();
    }
  },
  createCourse: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    let newCourseTup: Course;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const newCourse = req.body;
      if (typeof newCourse.price === "string") {
        newCourse.price = parseFloat(newCourse.price);
      }
      if (typeof newCourse.is_active === "string") {
        newCourse.is_active = Boolean(newCourse.is_active);
      }
      if (typeof newCourse.is_tamkeen_support === "string") {
        newCourse.is_tamkeen_support = Boolean(newCourse.is_tamkeen_support);
      }
      if (req.file) {
        const newFileName = `${Date.now()}${path.extname(
          req.file.originalname
        )}`;
        newCourse.thumbnail_url = `uploads/${newFileName}`;
      }
      newCourseTup = CourseSchema.parse(newCourse);
      const createCourseTup = await createCourse(newCourseTup, client);
      if (!createCourseTup.success) {
        await client.query("ROLLBACK");
        res.status(400);
        return next(createCourseTup.error);
      }
      await client.query("COMMIT");
      if (req.file) {
        const filePath = path.join(
          __dirname,
          "..",
          "uploads",
          path.basename(newCourse.thumbnail_url)
        );
        fs.writeFileSync(filePath, req.file.buffer);
      }
      return res.status(201).json({
        success: true,
        data: createCourseTup.data,
        message: "Course created successfully",
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      return next(err);
    } finally {
      client.release();
    }
  },
  updateCourse: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    const { id } = req.params;

    let oldFilePath: string | null = null;
    if (id == undefined || id == null) {
      return next(NOT_FOUND_ERROR);
    }
    let course: CourseUpdate;

    try {
      await client.query("BEGIN");
      const oldTup = await getCourseById(client, id.toString());
      if (!oldTup.success) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(oldTup.error);
      }
      const { created_at, updated_at, ...updateTup } = req.body;
      if (req.file) {
        if (req.file) {
          const newFileName = `${Date.now()}${path.extname(
            req.file.originalname
          )}`;
          updateTup.thumbnail_url = `uploads/${newFileName}`;

          if (oldTup.data.thumbnail_url) {
            oldFilePath = path.join(__dirname, "..", oldTup.data.thumbnail_url);
          }
        }
      }

      const filledUpdateTup = fillEmptyObject(updateTup, oldTup.data);
      if (typeof filledUpdateTup.price === "string") {
        filledUpdateTup.price = parseFloat(filledUpdateTup.price);
      }
      if (typeof filledUpdateTup.is_active === "string") {
        filledUpdateTup.is_active = Boolean(filledUpdateTup.is_active);
      }
      if (typeof filledUpdateTup.is_tamkeen_support === "string") {
        filledUpdateTup.is_tamkeen_support = Boolean(filledUpdateTup.is_tamkeen_support);
      }
      course = CourseUpdateSchema.parse(filledUpdateTup);
      const updateCourseTup = await updateCourse(client, course);
      if (!updateCourseTup.success) {
        await client.query("ROLLBACK");
        res.status(BAD_REQUEST);
        return next(updateCourseTup.error);
      }
      await client.query("COMMIT");
      if (req.file && course.thumbnail_url) {
        // Ensure uploads folder exists
        const uploadsDir = path.join(__dirname, "..", "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Write new file from buffer
        const newFilePath = path.join(__dirname, "..", course.thumbnail_url);
        fs.writeFileSync(newFilePath, req.file.buffer);

        // Delete old file if it exists
        if (oldFilePath && fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (err: any) {
            if (err.code !== "ENOENT") {
              console.error("Error deleting old file:", err);
            }
          }
        }
      }
      return res.status(SUCCESS).json({
        success: true,
        data: updateCourseTup.data,
        message: "Course Updated Successfully",
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      return next(err);
    } finally {
      client.release();
    }
  },
  deleteCourse: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { id } = req.params;
    const client = await pool.connect();
    if (id === undefined || id === null) {
      return next(NOT_FOUND_ERROR);
    }
    try {
      await client.query("BEGIN");
      const courseTup = await getCourseById(client, id.toString());
      if (!courseTup.success) {
        res.status(NOT_FOUND);
        await client.query("ROLLBACK");
        return next(courseTup.error);
      }
      const result = await deleteCourse(client, id.toString());
      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(NOT_FOUND);
        return next(result.error);
      }
      await client.query("COMMIT");
      if (courseTup.data.thumbnail_url) {
        const oldFilePath = path.join(
          __dirname,
          "..",
          courseTup.data.thumbnail_url
        );
        try {
          fs.unlinkSync(oldFilePath);
        } catch (err: any) {
          if (err.code !== "ENOENT") {
            console.error("Error deleting old file:", err);
          }
        }
      }
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        message: "Course deleted successfully.",
      });
    } catch (error: any) {
      await client.query("ROLLBACK");
      return next(error);
    } finally {
      client.release();
    }
  },
};
export default courseController;
