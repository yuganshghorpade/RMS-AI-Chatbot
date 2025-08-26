import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { ApiResponse } from '../utils/api-response.util.js';
import { ApiError } from '../utils/api-error.util.js';

export const uploadExcelFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, "No file uploaded");
    }

    const file = req.file;
    
    // Validate file extension
    const allowedExtensions = ['.xlsx', '.xls', '.xlsm', '.xltm'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      // Remove the uploaded file if it's not valid
      fs.unlinkSync(file.path);
      throw new ApiError(400, "Invalid file type. Only Excel files are allowed.");
    }

    // Read and validate Excel file
    let workbook;
    try {
      workbook = XLSX.readFile(file.path);
    } catch (error) {
      // Remove the uploaded file if it can't be read
      fs.unlinkSync(file.path);
      throw new ApiError(400, "Invalid Excel file. The file may be corrupted.");
    }

    // Get sheet names
    const sheetNames = workbook.SheetNames;
    
    // Get basic file info
    const fileInfo = {
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      path: file.path,
      sheetNames: sheetNames,
      uploadDate: new Date().toISOString()
    };

    // Optional: Get first sheet data preview (first 5 rows)
    if (sheetNames.length > 0) {
      const firstSheet = workbook.Sheets[sheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      fileInfo.preview = data.slice(0, 5); // First 5 rows
      fileInfo.totalRows = data.length;
    }

    return res.status(200).json(
      new ApiResponse(200, fileInfo, "Excel file uploaded successfully")
    );

  } catch (error) {
    next(error);
  }
};

export const getUploadedFiles = async (req, res, next) => {
  try {
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    
    // Check if directory exists
    if (!fs.existsSync(tempDir)) {
      return res.status(200).json(
        new ApiResponse(200, [], "No files found")
      );
    }

    // Read directory contents
    const files = fs.readdirSync(tempDir);
    const fileList = [];

    for (const filename of files) {
      const filePath = path.join(tempDir, filename);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        const ext = path.extname(filename).toLowerCase();
        if (['.xlsx', '.xls', '.xlsm', '.xltm'].includes(ext)) {
          fileList.push({
            filename,
            size: stats.size,
            uploadDate: stats.mtime,
            path: `/temp/${filename}`
          });
        }
      }
    }

    return res.status(200).json(
      new ApiResponse(200, fileList, "Files retrieved successfully")
    );

  } catch (error) {
    next(error);
  }
};

export const deleteFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      throw new ApiError(400, "Filename is required");
    }

    const filePath = path.join(process.cwd(), 'public', 'temp', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, "File not found");
    }

    // Delete the file
    fs.unlinkSync(filePath);

    return res.status(200).json(
      new ApiResponse(200, null, "File deleted successfully")
    );

  } catch (error) {
    next(error);
  }
};

export const downloadFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      throw new ApiError(400, "Filename is required");
    }

    const filePath = path.join(process.cwd(), 'public', 'temp', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, "File not found");
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send the file
    res.sendFile(filePath);

  } catch (error) {
    next(error);
  }
};
