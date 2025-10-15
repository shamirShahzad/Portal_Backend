import { NextFunction } from "express";
import { Course, CourseUpdate } from "../../models/courses";
import { AuthenticatedRequest } from "../../types/AuthenticatedRequest";
import { BAD_REQUEST_ERROR, NOT_FOUND_ERROR } from "../../util/Errors";
import { Pool, PoolClient, Result } from "pg";
import { success } from "zod";
import { error } from "console";

export const getAllCourses = async (client: any) => {
  const queryStr = `
        SELECT * FROM courses
        `;
  try {
    const result = await client.query(queryStr);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "No courses found",
        error: NOT_FOUND_ERROR("Courses not found"),
      };
    }
    return { success: true, data: result.rows };
  } catch (err) {
    return {
      success: false,
      errorMessage: "Something went wrong while fetching courses",
      error: err,
    };
  }
};

export const createCourse = async (newCourse: Course, client: any) => {
  let qStr = `
    INSERT INTO courses (
        title,
        subtitle,
        category,
        duration,
        format,
        level,
        description,
        prerequisites,
        thumbnail_url,
        price,
        is_active,
        is_tamkeen_support
        ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
        ) RETURNING *
`;
  try {
    const values = [
      newCourse.title,
      newCourse.subtitle,
      newCourse.category,
      newCourse.duration,
      newCourse.format,
      newCourse.level,
      newCourse.description,
      newCourse.prerequisites,
      newCourse.thumbnail_url,
      newCourse.price,
      newCourse.is_active,
      newCourse.is_tamkeen_support,
    ];
    const result = await client.query(qStr, values);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "Failed to create course",
        error: BAD_REQUEST_ERROR("Failed to create course"),
      };
    }
    if (result.rowCount == 0) {
      return {
        success: false,
        errorMessage: "Bad request",
        error: BAD_REQUEST_ERROR("Bad course request"),
      };
    }
    return { success: true, data: result.rows[0] };
  } catch (err: any) {
    return {
      success: false,
      errorMessage: "Something went wrong while creating course",
      error: err,
    };
  }
};

export const getCourseById = async (client: PoolClient, id: string) => {
  const qStr = `SELECT * FROM courses WHERE id= $1 `;
  try {
    const result = await client.query(qStr, [id]);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "Course not found",
        error: NOT_FOUND_ERROR("Course not found"),
      };
    }
    return {
      success: true,
      data: result.rows[0],
    };
  } catch (err: any) {
    return {
      success: false,
      errorMessage: "Something went wrong while fetching course",
      error: err,
    };
  }
};

export const updateCourse = async (
  client: PoolClient,
  course: CourseUpdate
) => {
  const {
    id,
    title,
    subtitle,
    category,
    duration,
    format,
    level,
    description,
    prerequisites,
    thumbnail_url,
    price,
    is_active,
    is_tamkeen_support,
  } = course;
  const qStr = `
  UPDATE courses SET
  title = $1,
  subtitle = $2,
  category = $3,
  duration = $4,
  format = $5,
  level = $6,
  description = $7,
  prerequisites = $8,
  thumbnail_url = $9,
  price = $10,
  is_active = $11,
  is_tamkeen_support = $12,
  updated_at = $13
  WHERE id = $14
  RETURNING *
  `;
  const values = [
    title,
    subtitle,
    category,
    duration,
    format,
    level,
    description,
    prerequisites,
    thumbnail_url,
    price,
    is_active,
    is_tamkeen_support,
    new Date().toISOString(),
    id,
  ];
  try {
    const result = await client.query(qStr, values);
    if (result.rows.length === 0) {
      return {
        success: false,
        error: NOT_FOUND_ERROR("Course not found"),
        errorMessage: "Course not found",
      };
    }
    return {
      success: true,
      data: result.rows[0],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err,
      errorMessage: "Something went wrong",
    };
  }
};

export const deleteCourse = async (client: PoolClient, id: string) => {
  const qStr = `DELETE FROM courses WHERE id = $1`;
  try {
    const result = await client.query(qStr, [id]);
    if (result.rowCount === 0) {
      return {
        success: false,
        error: NOT_FOUND_ERROR("Course not found"),
        errorMessage: "Course not Found",
      };
    }
    return {
      success: true,
      message: "Item Deleted Successfully",
    };
  } catch (err: any) {
    return {
      success: false,
      error: BAD_REQUEST_ERROR("Bad course request"),
      errorMessage: "Something went wrong while deleting course.",
    };
  }
};
