import pool from '../db/config';
import { PoolClient } from 'pg';
import { 
  getExportJob, 
  updateExportJob
} from '../db/functions/export_db_functions';
import { getDetailedApplicationsForExport } from '../db/functions/application_db_functions';
import { generateExcelFile, getFileSize } from './fileGenerators';

export interface ExportJob {
  id: string;
  name: string;
  data_types: {
    applications: boolean;
    courses: boolean;
    employees: boolean;
  };
  filters: any;
  status: string;
  progress: number;
  created_at: Date;
  requested_by: number;
  file_path?: string;
  file_size?: number;
  completed_at?: Date;
  error_message?: string;
}

export interface ExportData {
  applications?: any[];
  courses?: any[];
  employees?: any[];
}

export interface DataCollectionFilters {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  statusFilter?: string[];
  courseIds?: number[];
  priceRange?: { min: number; max: number };
  experienceRange?: { min: number; max: number };
  salaryRange?: { min: number; max: number };
  ageRange?: { min: number; max: number };
  locations?: string[];
  departments?: string[];
  positions?: string[];
  skillsRequired?: string[];
  educationLevels?: string[];
  employmentTypes?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class ExportProcessor {
  private processingJobs: Set<string> = new Set();
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    console.log('ExportProcessor initialized');
  }

  // Get database connection with retry logic and error handling
  private async getDbConnection(maxRetries: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting database connection (attempt ${attempt}/${maxRetries})`);
        
        // Create a promise that resolves with connection or rejects with timeout
        const connectionPromise = pool.connect();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database connection timeout')), 5000);
        });
        
        // Race between connection and timeout
        const client = await Promise.race([connectionPromise, timeoutPromise]);
        console.log('Database connection established successfully');
        return client;
        
      } catch (error: any) {
        console.error(`Database connection attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`Retrying database connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Start the processor
  start() {
    if (this.isRunning) {
      console.log('ExportProcessor is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting ExportProcessor...');
    
    // Process immediately, then every 30 seconds
    this.processExports();
    this.intervalId = setInterval(() => {
      this.processExports();
    }, 30000);
  }

  // Stop the processor
  stop() {
    if (!this.isRunning) {
      console.log('ExportProcessor is not running');
      return;
    }

    this.isRunning = false;
    console.log('Stopping ExportProcessor...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // Wait for current jobs to complete
    return new Promise<void>((resolve) => {
      const checkComplete = () => {
        if (this.processingJobs.size === 0) {
          console.log('ExportProcessor stopped');
          resolve();
        } else {
          console.log(`Waiting for ${this.processingJobs.size} jobs to complete...`);
          setTimeout(checkComplete, 1000);
        }
      };
      checkComplete();
    });
  }

  // Process pending exports
  async processExports() {
    if (!this.isRunning) return;

    let client;
    try {
      // Try to get a database connection with timeout handling
      client = await this.getDbConnection();
      
      // Get pending export jobs
      const query = `
        SELECT * FROM export_jobs 
        WHERE status = 'pending' 
        ORDER BY created_at ASC
        LIMIT 5
      `;
      
      const result = await client.query(query);
      
      if (result.rows.length > 0) {
        console.log(`Found ${result.rows.length} pending export jobs`);
        
        for (const row of result.rows) {
          // Skip if already processing
          if (this.processingJobs.has(row.id)) {
            continue;
          }
          
          // Process job asynchronously
          this.processExportJob(row).catch(error => {
            console.error(`Error processing export job ${row.id}:`, error);
          });
        }
      }
      
    } catch (error) {
      console.error('Error fetching pending exports:', error);
    } finally {
      // Release client if it exists
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Error releasing database client:', releaseError);
        }
      }
    }
  }

  // Process a single export job
  async processExportJob(exportJob: ExportJob) {
    let client;
    
    try {
      // Get database connection with error handling
      client = await this.getDbConnection();
      
      // Mark job as being processed
      this.processingJobs.add(exportJob.id);
      
      console.log(`Processing export job: ${exportJob.id} - ${exportJob.name}`);
      
      // Update status to processing
      await updateExportJob(client, exportJob.id, {
        status: 'processing',
        progress: 0
      });
      
      // Collect data based on selections with timeout
      const dataCollectionPromise = this.collectData(client, exportJob);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Data collection timeout')), 300000); // 5 minutes
      });
      
      const data = await Promise.race([dataCollectionPromise, timeoutPromise]) as ExportData;
      
      // Update progress
      await updateExportJob(client, exportJob.id, { progress: 75 });
      
      // Generate file
      console.log(`Generating file for export job: ${exportJob.id}`);
      const fileName = this.generateFileName(exportJob);
      const filePath = await generateExcelFile(data, fileName);
      
      // Update progress
      await updateExportJob(client, exportJob.id, { progress: 90 });
      
      // Get file size
      const fileSize = await getFileSize(filePath);
      
      // Update job with completion details
      await updateExportJob(client, exportJob.id, {
        status: 'completed',
        file_path: filePath,
        file_size: fileSize,
        progress: 100,
        completed_at: new Date()
      });
      
      console.log(`Export job completed: ${exportJob.id}`);
      
    } catch (error: any) {
      console.error(`Export job failed: ${exportJob.id}`, error);
      
      // Only try to update job status if we have a valid client connection
      if (client) {
        try {
          await updateExportJob(client, exportJob.id, {
            status: 'failed',
            error_message: error.message || 'Unknown error occurred'
          });
        } catch (updateError) {
          console.error(`Failed to update job status for ${exportJob.id}:`, updateError);
        }
      }
    } finally {
      // Always remove from processing set
      this.processingJobs.delete(exportJob.id);
      
      // Release client if it exists
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Error releasing database client:', releaseError);
        }
      }
    }
  }

  // Collect data based on export job configuration
  async collectData(client: PoolClient, exportJob: ExportJob): Promise<ExportData> {
    const data: ExportData = {};
    const dataTypes = exportJob.data_types;
    const filters = exportJob.filters;
    
    try {
      // Collect applications data
      if (dataTypes.applications) {
        console.log('Collecting applications data...');
        const applicationsResult = await this.getApplicationsData(client, filters);
        if (applicationsResult.success) {
          data.applications = (applicationsResult as any).data || [];
          console.log(`Collected ${data.applications?.length || 0} applications`);
        } else {
          console.warn('Failed to collect applications data:', (applicationsResult as any).error);
        }
      }
      
      // Collect courses data (placeholder)
      if (dataTypes.courses) {
        console.log('Collecting courses data...');
        data.courses = [];
        console.log(`Collected ${data.courses.length} courses`);
      }
      
      // Collect employees data (placeholder)
      if (dataTypes.employees) {
        console.log('Collecting employees data...');
        data.employees = [];
        console.log(`Collected ${data.employees.length} employees`);
      }
      
      return data;
      
    } catch (error) {
      console.error('Error collecting data:', error);
      throw error;
    }
  }

  // Get applications data with comprehensive filtering
  async getApplicationsData(client: PoolClient, filters: DataCollectionFilters) {
    try {
      // Convert filters to the format expected by the database function
      const dbFilters: any = {};
      
      // Date range
      if (filters.dateRange) {
        if (filters.dateRange === 'custom') {
          // For custom ranges, use the provided startDate and endDate
          if (filters.startDate && filters.endDate) {
            dbFilters.dateRange = { 
              startDate: filters.startDate, 
              endDate: filters.endDate 
            };
          } else {
            console.warn('Custom date range selected but startDate/endDate not provided');
            // Default to last 30 days
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            dbFilters.dateRange = { 
              startDate: thirtyDaysAgo.toISOString().split('T')[0], 
              endDate: now.toISOString().split('T')[0] 
            };
          }
        } else {
          // For predefined ranges, use the parseDateRange function
          const { startDate, endDate } = this.parseDateRange(filters.dateRange);
          dbFilters.dateRange = { startDate, endDate };
        }
      }
      
      // Status filter
      if (filters.statusFilter && filters.statusFilter.length > 0) {
        dbFilters.statusFilter = filters.statusFilter;
      }
      
      // Course IDs
      if (filters.courseIds && filters.courseIds.length > 0) {
        dbFilters.courseIds = filters.courseIds;
      }
      
      // Price range
      if (filters.priceRange) {
        dbFilters.priceRange = filters.priceRange;
      }
      
      // Experience range
      if (filters.experienceRange) {
        dbFilters.experienceRange = filters.experienceRange;
      }
      
      // Age range
      if (filters.ageRange) {
        dbFilters.ageRange = filters.ageRange;
      }
      
      // Locations
      if (filters.locations && filters.locations.length > 0) {
        dbFilters.locations = filters.locations;
      }
      
      // Skills required
      if (filters.skillsRequired && filters.skillsRequired.length > 0) {
        dbFilters.skillsRequired = filters.skillsRequired;
      }
      
      // Education levels
      if (filters.educationLevels && filters.educationLevels.length > 0) {
        dbFilters.educationLevels = filters.educationLevels;
      }
      
      // Employment types
      if (filters.employmentTypes && filters.employmentTypes.length > 0) {
        dbFilters.employmentTypes = filters.employmentTypes;
      }
      
      // Sorting
      if (filters.sortBy) {
        dbFilters.sortBy = filters.sortBy;
        dbFilters.sortOrder = filters.sortOrder || 'asc';
      }
      
      // Pagination
      if (filters.limit) {
        dbFilters.limit = filters.limit;
      }
      if (filters.offset) {
        dbFilters.offset = filters.offset;
      }
      
      const result = await getDetailedApplicationsForExport(client, dbFilters);
      return result;
      
    } catch (error: any) {
      console.error('Error getting applications data:', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  // Parse date range string into start and end dates
  private parseDateRange(dateRange: string): { startDate: string, endDate: string } {
    try {
      console.log('Parsing date range:', dateRange);
      
      // Handle predefined ranges
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      // Normalize the dateRange by removing hyphens for backward compatibility
      const normalizedRange = dateRange.replace(/-/g, '');

      switch (normalizedRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now);
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
          break;
        case 'last7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = new Date(now);
          break;
        case 'last30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          endDate = new Date(now);
          break;
        case 'last90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          endDate = new Date(now);
          break;
        case 'thisweek':
          const dayOfWeek = now.getDay();
          startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          break;
        case 'thismonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now);
          break;
        case 'thisyear':
        case 'currentyear':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now);
          break;
        case 'lastyear':
          startDate = new Date(now.getFullYear() - 1, 0, 1);
          endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
          break;
        case 'currentmonth':
        case 'thismonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now);
          break;
        case 'lastmonth':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          startDate = lastMonth;
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // Last day of previous month
          break;
        case 'currentquarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart, 1);
          endDate = new Date(now);
          break;
        case 'lastquarter':
          const prevQuarterStart = Math.floor(now.getMonth() / 3) * 3 - 3;
          const quarterYear = prevQuarterStart < 0 ? now.getFullYear() - 1 : now.getFullYear();
          const adjustedQuarterStart = prevQuarterStart < 0 ? 9 : prevQuarterStart;
          startDate = new Date(quarterYear, adjustedQuarterStart, 1);
          endDate = new Date(quarterYear, adjustedQuarterStart + 3, 0, 23, 59, 59);
          break;
        case 'custom':
          // For custom range, we should expect startDate and endDate to be provided separately
          // This case should not normally be reached as custom dates should be handled differently
          console.warn('Custom date range selected but no start/end dates provided');
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          endDate = new Date(now);
          break;
        default:
          // Try to parse as custom range "YYYY-MM-DD to YYYY-MM-DD"
          if (dateRange.includes(' to ')) {
            const [start, end] = dateRange.split(' to ');
            startDate = new Date(start);
            endDate = new Date(end);
          } else {
            // Single date
            startDate = new Date(dateRange);
            endDate = new Date(dateRange);
            endDate.setHours(23, 59, 59, 999);
          }
      }

      // Validate dates before converting to ISO string
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error(`Invalid date format: ${dateRange}`);
      }

      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Error parsing date range:', error);
      console.error('Invalid date range value:', dateRange);
      
      // Default to last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      console.log('Using default date range: last 30 days');
      return {
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0]
      };
    }
  }

  // Generate filename for export
  private generateFileName(exportJob: ExportJob): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const sanitizedName = exportJob.name.replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedName}_${timestamp}_${exportJob.id}`;
  }
}

// Export singleton instance
export const exportProcessor = new ExportProcessor();