import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest";
import { STATUS_CODES } from "../util/enums";
import pool from "../db/config";
import { z } from "zod";
import {
  createExportJob,
  getExportJob,
  updateExportJob,
  getExportJobsByUser,
  deleteExportJob,
  ExportJobData
} from "../db/functions/export_db_functions";
import fs from "fs";
import path from "path";

const { BAD_REQUEST, SUCCESS, CREATED, NOT_FOUND, UNAUTHORIZED, FORBIDDEN } = STATUS_CODES;

// Zod schemas for validation
const CreateExportSchema = z.object({
  name: z.string().min(1, "Export name is required"),
  dataTypes: z.object({
    applications: z.boolean().optional().default(false),
    training: z.boolean().optional().default(false),
    employees: z.boolean().optional().default(false),
    courses: z.boolean().optional().default(false)
  }).refine(
    (data) => Object.values(data).some(Boolean),
    { message: "At least one data type must be selected" }
  ),
  filters: z.object({
    // Date range filters
    dateRange: z.enum([
      'last-7-days', 
      'last-30-days', 
      'last-90-days', 
      'last-year',
      'current-month',
      'current-quarter', 
      'current-year',
      'last-month',
      'last-quarter',
      'custom'
    ]).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    
    // Application specific filters
    applicationStatus: z.array(z.enum(['submitted', 'under_review', 'approved', 'rejected', 'cancelled'])).optional().default([]),
    applicationPriority: z.array(z.enum(['low', 'medium', 'high'])).optional().default([]),
    applicantDepartment: z.array(z.string()).optional().default([]),
    applicantSubOrganization: z.array(z.string()).optional().default([]),
    courseCategories: z.array(z.string()).optional().default([]),
    reviewedBy: z.array(z.string()).optional().default([]),
    
    // Course specific filters
    courseLevel: z.array(z.enum(['beginner', 'intermediate', 'advanced', 'expert'])).optional().default([]),
    courseFormat: z.array(z.string()).optional().default([]),
    courseCategory: z.array(z.string()).optional().default([]),
    courseIds: z.array(z.string().uuid()).optional().default([]), // Filter by specific course IDs
    priceRange: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional()
    }).optional(),
    courseActive: z.boolean().optional(),
    
    // Employee specific filters
    employeeDepartment: z.array(z.string()).optional().default([]),
    employeeRole: z.array(z.enum(['admin', 'applicant', 'super_admin'])).optional().default([]),
    employeeSubOrganization: z.array(z.string()).optional().default([]),
    experienceRange: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional()
    }).optional(),
    jobTitle: z.array(z.string()).optional().default([]),
    managerName: z.array(z.string()).optional().default([]),
    
    // Date field selections (which date field to filter on)
    dateField: z.object({
      applications: z.enum(['submitted_at', 'reviewed_at', 'created_at', 'updated_at']).optional().default('created_at'),
      courses: z.enum(['created_at', 'updated_at']).optional().default('created_at'),
      employees: z.enum(['created_at', 'updated_at']).optional().default('created_at')
    }).optional().default({
      applications: 'created_at',
      courses: 'created_at', 
      employees: 'created_at'
    }),
    
    // Advanced filters
    textSearch: z.string().optional(), // Global text search across relevant fields
    excludeInactive: z.boolean().optional().default(false), // Exclude inactive records
    includeDeleted: z.boolean().optional().default(false), // Include soft-deleted records
    
    // Legacy filters (for backward compatibility)
    organizations: z.array(z.string()).optional().default([]),
    status: z.array(z.string()).optional().default([])
  }).refine(
    (data) => {
      // If dateRange is custom, both startDate and endDate are required
      if (data.dateRange === 'custom') {
        return data.startDate && data.endDate;
      }
      return true;
    },
    { 
      message: "startDate and endDate are required when dateRange is 'custom'",
      path: ['startDate']
    }
  ).refine(
    (data) => {
      // Validate price range
      if (data.priceRange && data.priceRange.min !== undefined && data.priceRange.max !== undefined) {
        return data.priceRange.min <= data.priceRange.max;
      }
      return true;
    },
    {
      message: "Price range minimum must be less than or equal to maximum",
      path: ['priceRange']
    }
  ).refine(
    (data) => {
      // Validate experience range
      if (data.experienceRange && data.experienceRange.min !== undefined && data.experienceRange.max !== undefined) {
        return data.experienceRange.min <= data.experienceRange.max;
      }
      return true;
    },
    {
      message: "Experience range minimum must be less than or equal to maximum",
      path: ['experienceRange']
    }
  ),
  format: z.enum(['excel', 'csv', 'pdf', 'json']),
  scheduling: z.object({
    type: z.enum(['one-time', 'daily', 'weekly', 'monthly']).default('one-time'),
    schedule: z.string().optional()
  }).optional().default({ type: 'one-time' })
});

const ExportQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val)).pipe(z.number().min(1)).optional().default(1),
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(100)).optional().default(10),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional()
});

// Check export permissions based on user role
const checkExportPermissions = (userRole: string, dataTypes: any): boolean => {
  // Super admin can export everything
  if (userRole === 'super_admin') return true;
  
  // Admin can export applications and courses, but not employees data
  if (userRole === 'admin') {
    return !dataTypes.employees;
  }
  
  // Regular users cannot export anything
  return false;
};

const exportController = {
  // Create a new export job
  createExport: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    
    try {
      await client.query("BEGIN");
      
      // Validate request body
      const exportData = CreateExportSchema.parse(req.body);
      
      // Check permissions
      if (!checkExportPermissions(req.user!.role, exportData.dataTypes)) {
        await client.query("ROLLBACK");
        res.status(FORBIDDEN);
        return next(new Error("Insufficient permissions to export requested data types"));
      }
      
      // Create export job
      const jobData: ExportJobData = {
        user_id: req.user!.id,
        name: exportData.name,
        data_types: exportData.dataTypes,
        filters: exportData.filters,
        format: exportData.format,
        scheduling: exportData.scheduling
      };
      
      const result = await createExportJob(client, jobData);
      
      if (!result.success) {
        await client.query("ROLLBACK");
        res.status(result.statusCode);
        return next(result.error);
      }
      
      await client.query("COMMIT");
      
      return res.status(CREATED).json({
        success: true,
        statusCode: CREATED,
        message: "Export job created successfully",
        data: {
          exportId: result.data.id,
          status: result.data.status
        }
      });
      
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release();
    }
  },

  // Get export job status
  getExportStatus: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    const { exportId } = req.params;
    
    try {
      // Get export job - restrict to user's own exports unless admin
      const userId = req.user!.role === 'super_admin' ? undefined : req.user!.id;
      const result = await getExportJob(client, exportId, userId);
      
      if (!result.success) {
        res.status(result.statusCode);
        return next(result.error);
      }
      
      const exportJob = result.data;
      
      // Prepare response data
      const responseData: any = {
        id: exportJob.id,
        name: exportJob.name,
        status: exportJob.status,
        progress: exportJob.progress,
        format: exportJob.format,
        createdAt: exportJob.created_at,
        completedAt: exportJob.completed_at
      };
      
      // Add file info if completed
      if (exportJob.status === 'completed' && exportJob.file_path) {
        responseData.fileSize = exportJob.file_size;
        responseData.downloadUrl = `/api/v1/exports/${exportId}/download`;
      }
      
      // Add error message if failed
      if (exportJob.status === 'failed') {
        responseData.errorMessage = exportJob.error_message;
      }
      
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        data: responseData
      });
      
    } catch (err: any) {
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release();
    }
  },

  // Get export history for user
  getExportHistory: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    
    try {
      // Validate query parameters
      const queryParams = ExportQuerySchema.parse(req.query);
      
      // Get exports - restrict to user's own exports unless admin
      const userId = req.user!.role === 'super_admin' ? undefined : req.user!.id;
      const result = await getExportJobsByUser(
        client,
        userId || req.user!.id,
        queryParams.page,
        queryParams.limit,
        queryParams.status
      );
      
      if (!result.success) {
        res.status(result.statusCode);
        return next(result.error);
      }
      
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        data: result.data
      });
      
    } catch (err: any) {
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release();
    }
  },

  // Download export file
  downloadExport: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    const { exportId } = req.params;
    
    try {
      // Get export job - restrict to user's own exports unless admin
      const userId = req.user!.role === 'super_admin' ? undefined : req.user!.id;
      const result = await getExportJob(client, exportId, userId);
      
      if (!result.success) {
        res.status(result.statusCode);
        return next(result.error);
      }
      
      const exportJob = result.data;
      
      // Check if export is completed and file exists
      if (exportJob.status !== 'completed') {
        res.status(BAD_REQUEST);
        return next(new Error("Export is not completed yet"));
      }
      
      if (!exportJob.file_path || !fs.existsSync(exportJob.file_path)) {
        res.status(NOT_FOUND);
        return next(new Error("Export file not found"));
      }
      
      // Set appropriate headers based on file format
      const fileExtension = path.extname(exportJob.file_path);
      const fileName = `${exportJob.name}${fileExtension}`;
      
      let contentType = 'application/octet-stream';
      switch (exportJob.format) {
        case 'excel':
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'csv':
          contentType = 'text/csv; charset=utf-8';
          break;
        case 'pdf':
          contentType = 'application/pdf';
          break;
        case 'json':
          contentType = 'application/json; charset=utf-8';
          break;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', exportJob.file_size || 0);
      
      // Stream the file
      const fileStream = fs.createReadStream(exportJob.file_path);
      fileStream.pipe(res);
      
    } catch (err: any) {
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release();
    }
  },

  // Delete export job
  deleteExport: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const client = await pool.connect();
    const { exportId } = req.params;
    
    try {
      await client.query("BEGIN");
      
      // Get export job first to check file path
      const userId = req.user!.role === 'super_admin' ? undefined : req.user!.id;
      const getResult = await getExportJob(client, exportId, userId);
      
      if (!getResult.success) {
        await client.query("ROLLBACK");
        res.status(getResult.statusCode);
        return next(getResult.error);
      }
      
      const exportJob = getResult.data;
      
      // Delete from database
      const deleteResult = await deleteExportJob(client, exportId, userId);
      
      if (!deleteResult.success) {
        await client.query("ROLLBACK");
        res.status(deleteResult.statusCode);
        return next(deleteResult.error);
      }
      
      // Delete physical file if exists
      if (exportJob.file_path && fs.existsSync(exportJob.file_path)) {
        try {
          fs.unlinkSync(exportJob.file_path);
        } catch (fileError) {
          console.error('Error deleting export file:', fileError);
          // Don't fail the request if file deletion fails
        }
      }
      
      await client.query("COMMIT");
      
      return res.status(SUCCESS).json({
        success: true,
        statusCode: SUCCESS,
        message: "Export deleted successfully"
      });
      
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(BAD_REQUEST);
      return next(err);
    } finally {
      client.release();
    }
  }
};

export default exportController;