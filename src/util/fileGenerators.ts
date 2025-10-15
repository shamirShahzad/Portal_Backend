import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import * as csvWriter from 'csv-writer';
import fs from 'fs';
import path from 'path';

export interface ExportData {
  applications?: any[];
  training?: any[];
  employees?: any[];
  courses?: any[];
}

export interface FileGenerationOptions {
  format: 'excel' | 'csv' | 'pdf' | 'json';
  data: ExportData;
  fileName: string;
  outputPath: string;
}

// Ensure export directory exists
const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Get the exports directory path
const getExportsDir = () => {
  const exportsDir = process.env.EXPORT_STORAGE_PATH || path.join(process.cwd(), 'exports');
  ensureDirectoryExists(exportsDir);
  return exportsDir;
};

// Generate Excel file
export const generateExcelFile = async (data: ExportData, fileName: string): Promise<string> => {
  const workbook = new ExcelJS.Workbook();
  const outputPath = path.join(getExportsDir(), `${fileName}.xlsx`);
  
  // Create worksheets for each data type
  if (data.applications && data.applications.length > 0) {
    const worksheet = workbook.addWorksheet('Applications');
    
    // Define columns based on application data structure
    const columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Applicant Name', key: 'applicant_name', width: 20 },
      { header: 'Course Title', key: 'course_title', width: 30 },
      { header: 'Tamkeen Support', key: 'course_is_tamkeen_support', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Submitted At', key: 'submitted_at', width: 20 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Manager Name', key: 'manager_name', width: 20 },
      { header: 'Manager Email', key: 'manager_email', width: 25 }
    ];
    
    worksheet.columns = columns;
    
    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Add data rows
    data.applications.forEach((app) => {
      worksheet.addRow({
        id: app.id,
        applicant_name: app.applicant_name || `${app.first_name} ${app.last_name}`,
        course_title: app.course_title,
        course_is_tamkeen_support: app.course_is_tamkeen_support ? 'Yes' : 'No',
        status: app.status,
        priority: app.priority,
        submitted_at: new Date(app.submitted_at).toLocaleDateString(),
        department: app.department,
        job_title: app.job_title,
        manager_name: app.manager_name,
        manager_email: app.manager_email
      });
    });
  }
  
  if (data.courses && data.courses.length > 0) {
    const worksheet = workbook.addWorksheet('Courses');
    
    const columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Level', key: 'level', width: 15 },
      { header: 'Duration', key: 'duration', width: 15 },
      { header: 'Format', key: 'format', width: 20 },
      { header: 'Price', key: 'price', width: 10 },
      { header: 'Active', key: 'is_active', width: 10 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ];
    
    worksheet.columns = columns;
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    data.courses.forEach((course) => {
      worksheet.addRow({
        id: course.id,
        title: course.title,
        category: course.category,
        level: course.level,
        duration: course.duration,
        format: course.format,
        price: course.price,
        is_active: course.is_active ? 'Yes' : 'No',
        created_at: new Date(course.created_at).toLocaleDateString()
      });
    });
  }
  
  if (data.employees && data.employees.length > 0) {
    const worksheet = workbook.addWorksheet('Employees');
    
    const columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Full Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Employee ID', key: 'employee_id', width: 15 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Job Title', key: 'job_title', width: 25 },
      { header: 'Experience Years', key: 'experience_years', width: 15 },
      { header: 'Manager Name', key: 'manager_name', width: 25 },
      { header: 'Manager Email', key: 'manager_email', width: 30 }
    ];
    
    worksheet.columns = columns;
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    data.employees.forEach((employee) => {
      worksheet.addRow({
        id: employee.id,
        full_name: employee.full_name,
        email: employee.email,
        employee_id: employee.employee_id,
        department: employee.department,
        job_title: employee.job_title,
        experience_years: employee.experience_years,
        manager_name: employee.manager_name,
        manager_email: employee.manager_email
      });
    });
  }
  
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
};

// Generate CSV file
export const generateCSVFile = async (data: ExportData, fileName: string): Promise<string> => {
  const outputPath = path.join(getExportsDir(), `${fileName}.csv`);
  
  // Helper function to escape CSV values
  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    
    const str = String(value);
    // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Prepare CSV content
  let csvContent = '';
  
  // Add UTF-8 BOM for proper encoding
  csvContent += '\uFEFF';
  
  // Add header row
  const headers = ['Type', 'ID', 'Name', 'Title/Category', 'Tamkeen Support', 'Status', 'Department/Level', 'Date', 'Additional Info'];
  csvContent += headers.map(escapeCSVValue).join(',') + '\n';
  
  // Add applications data
  if (data.applications && data.applications.length > 0) {
    data.applications.forEach(app => {
      const row = [
        'Application',
        app.id || '',
        app.applicant_name || `${app.first_name || ''} ${app.last_name || ''}`.trim(),
        app.course_title || '',
        app.course_is_tamkeen_support ? 'Yes' : 'No',
        app.status || '',
        app.department || '',
        app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '',
        `Priority: ${app.priority || 'N/A'}`
      ];
      csvContent += row.map(escapeCSVValue).join(',') + '\n';
    });
  }
  
  // Add courses data
  if (data.courses && data.courses.length > 0) {
    data.courses.forEach(course => {
      const row = [
        'Course',
        course.id || '',
        course.title || '',
        course.category || '',
        course.is_tamkeen_support ? 'Yes' : 'No',
        course.is_active ? 'Active' : 'Inactive',
        course.level || '',
        course.created_at ? new Date(course.created_at).toLocaleDateString() : '',
        `Duration: ${course.duration || 'N/A'}, Format: ${course.format || 'N/A'}`
      ];
      csvContent += row.map(escapeCSVValue).join(',') + '\n';
    });
  }
  
  // Add employees data
  if (data.employees && data.employees.length > 0) {
    data.employees.forEach(employee => {
      const row = [
        'Employee',
        employee.id || '',
        employee.full_name || '',
        employee.job_title || '',
        'Active',
        employee.department || '',
        '',
        `Experience: ${employee.experience_years || 0} years, Manager: ${employee.manager_name || 'N/A'}`
      ];
      csvContent += row.map(escapeCSVValue).join(',') + '\n';
    });
  }
  
  // Write file with explicit UTF-8 encoding
  fs.writeFileSync(outputPath, csvContent, { encoding: 'utf8' });
  
  return outputPath;
};

// Generate PDF file
export const generatePDFFile = async (data: ExportData, fileName: string): Promise<string> => {
  const outputPath = path.join(getExportsDir(), `${fileName}.pdf`);
  const doc = new PDFDocument();
  
  // Create a write stream
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  
  // Add title
  doc.fontSize(20).text('Export Report', 50, 50);
  doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 80);
  
  let yPos = 120;
  
  // Applications section
  if (data.applications && data.applications.length > 0) {
    doc.fontSize(16).text('Applications', 50, yPos);
    yPos += 30;
    
    data.applications.slice(0, 20).forEach((app, index) => { // Limit to first 20 to avoid page overflow
      if (yPos > 700) { // Start new page if near bottom
        doc.addPage();
        yPos = 50;
      }
      
      doc.fontSize(10)
        .text(`${index + 1}. ${app.applicant_name || `${app.first_name} ${app.last_name}`} - ${app.course_title}`, 70, yPos)
        .text(`Status: ${app.status}, Department: ${app.department}, Tamkeen: ${app.course_is_tamkeen_support ? 'Yes' : 'No'}`, 90, yPos + 15);
      yPos += 35;
    });
    
    if (data.applications.length > 20) {
      doc.text(`... and ${data.applications.length - 20} more applications`, 70, yPos);
      yPos += 20;
    }
    yPos += 20;
  }
  
  // Courses section
  if (data.courses && data.courses.length > 0) {
    if (yPos > 600) {
      doc.addPage();
      yPos = 50;
    }
    
    doc.fontSize(16).text('Courses', 50, yPos);
    yPos += 30;
    
    data.courses.slice(0, 15).forEach((course, index) => {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }
      
      doc.fontSize(10)
        .text(`${index + 1}. ${course.title} - ${course.category}`, 70, yPos)
        .text(`Level: ${course.level}, Duration: ${course.duration}, Tamkeen: ${course.is_tamkeen_support ? 'Yes' : 'No'}`, 90, yPos + 15);
      yPos += 35;
    });
    
    if (data.courses.length > 15) {
      doc.text(`... and ${data.courses.length - 15} more courses`, 70, yPos);
      yPos += 20;
    }
    yPos += 20;
  }
  
  // Employees section
  if (data.employees && data.employees.length > 0) {
    if (yPos > 600) {
      doc.addPage();
      yPos = 50;
    }
    
    doc.fontSize(16).text('Employees', 50, yPos);
    yPos += 30;
    
    data.employees.slice(0, 15).forEach((employee, index) => {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }
      
      doc.fontSize(10)
        .text(`${index + 1}. ${employee.full_name} - ${employee.job_title}`, 70, yPos)
        .text(`Department: ${employee.department}, Experience: ${employee.experience_years} years`, 90, yPos + 15);
      yPos += 35;
    });
    
    if (data.employees.length > 15) {
      doc.text(`... and ${data.employees.length - 15} more employees`, 70, yPos);
    }
  }
  
  doc.end();
  
  // Return a promise that resolves when the file is written
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
};

// Generate JSON file
export const generateJSONFile = async (data: ExportData, fileName: string): Promise<string> => {
  const outputPath = path.join(getExportsDir(), `${fileName}.json`);
  
  const exportData = {
    generated_at: new Date().toISOString(),
    data: data
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  return outputPath;
};

// Main file generation function
export const generateFile = async (options: FileGenerationOptions): Promise<string> => {
  const { format, data, fileName } = options;
  
  switch (format) {
    case 'excel':
      return generateExcelFile(data, fileName);
    case 'csv':
      return generateCSVFile(data, fileName);
    case 'pdf':
      return generatePDFFile(data, fileName);
    case 'json':
      return generateJSONFile(data, fileName);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
};

// Get file size
export const getFileSize = async (filePath: string): Promise<number> => {
  const stats = fs.statSync(filePath);
  return stats.size;
};

// Clean up expired files
export const cleanupFile = async (filePath: string): Promise<void> => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};