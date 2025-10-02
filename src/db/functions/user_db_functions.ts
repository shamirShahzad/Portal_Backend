import { UserProfileSchema } from "../../models/user_profiles";
import { UserSchema } from "../../models/users";
import { z } from "zod";
import { PoolClient } from "pg";
import { BAD_REQUEST_ERROR, NOT_FOUND_ERROR } from "../../util/Errors";
import pool from "../config";

export const regsiterUser = async (
  client: any,
  User: z.infer<typeof UserSchema>
) => {
  const queryStr = `
        INSERT INTO users 
        (
        email,
        password,
        confirmation_token
        )
        VALUES($1,$2,$3)
        RETURNING id,confirmation_token
        `;
  try {
    const result = await client.query(queryStr, [
      User.email,
      User.password,
      User.confirmation_token,
    ]);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "Failed to register user",
        error: BAD_REQUEST_ERROR("Failed to create user"),
      };
    }
    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while registering user",
      error: error,
    };
  }
};

export const createUserProfile = async (
  client: any,
  userProfileData: z.infer<typeof UserProfileSchema>
) => {
  const queryStr = `
        INSERT INTO user_profiles (
            id,
            full_name,
            employee_id,
            department,
            phone_number,
            sub_organization,
            job_title,
            experience_years,
            manager_name,
            manager_email,
            role,
            avatar_url
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        RETURNING *
    `;
  try {
    const values = [
      userProfileData.id,
      userProfileData.full_name,
      userProfileData.employee_id,
      userProfileData.department,
      userProfileData.phone_number,
      userProfileData.sub_organization,
      userProfileData.job_title,
      userProfileData.experience_years,
      userProfileData.manager_name,
      userProfileData.manager_email,
      userProfileData.role,
      userProfileData.avatar_url ?? null,
    ];
    const result = await client.query(queryStr, values);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "Failed to create user profile",
        error: BAD_REQUEST_ERROR("Failed to create user"),
      };
    }
    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while creating user profile",
      error: error,
    };
  }
};

export const setUserConfirmationSentAt = async (
  client: any,
  userId: string
) => {
  const queryStr = `
        UPDATE users
        SET confirmation_sent_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
    `;
  try {
    const result = await client.query(queryStr, [userId]);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "Failed to update confirmation_sent_at",
        error: BAD_REQUEST_ERROR("Bad update request"),
      };
    }
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while updating confirmation_sent_at",
      error: error,
    };
  }
  return { success: true };
};

export const setConfirmedAt = async (client: any, email: string) => {
  const queryStr = `
        UPDATE users
        SET confirmed_at = CURRENT_TIMESTAMP, confirmation_token = NULL
        WHERE email = $1
        RETURNING *
    `;
  try {
    const result = await client.query(queryStr, [email]);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "Failed to update confirmed_at",
        error: BAD_REQUEST_ERROR("Bad updation request"),
      };
    }
    return { success: true, data: result.rows[0] };
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while updating confirmed_at",
      error: error,
    };
  }
};

export const getUserByEmail = async (client: any, email: string) => {
  const queryStr = `
        SELECT * FROM users WHERE email = $1
    `;
  try {
    const result = await client.query(queryStr, [email]);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "User not found",
        error: NOT_FOUND_ERROR("User not found"),
      };
    }
    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while fetching user by email",
      error: error,
    };
  }
};

export const getUserById = async (client: PoolClient, userId: string) => {
  const queryStr = `
        SELECT 
            u.id,
            u.email,
            up.full_name,
            up.employee_id,
            up.phone_number,
            up.role
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.id
        WHERE u.id = $1
    `;
  try {
    const result = await client.query(queryStr, [userId]);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "User not found",
        error: NOT_FOUND_ERROR("User not found"),
      };
    }
    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while fetching user by id",
      error: error,
      data: {},
    };
  }
};

export const getUserByIdNoClient = async (userId: string) => {
  const client = await pool.connect();
  const queryStr = `
        SELECT 
            u.id,
            u.email,
            up.full_name,
            up.employee_id,
            up.phone_number,
            up.role
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.id
        WHERE u.id = $1
    `;
  try {
    const result = await client.query(queryStr, [userId]);
    if (result.rows.length === 0) {
      return {
        success: false,
        errorMessage: "User not found",
        error: NOT_FOUND_ERROR("User not found"),
      };
    }
    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: "Something went wrong while fetching user by id",
      error: error,
      data: {},
    };
  }
};
