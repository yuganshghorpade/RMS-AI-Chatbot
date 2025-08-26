import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import { CONFIG } from "../config/config.js";

const uploadExcelFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No Excel file uploaded"
      });
    }

    // Allow only Excel files
    const allowedTypes = ['.xlsx', '.xls'];
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      return res.status(400).json({
        success: false,
        error: "Invalid file type. Only Excel (.xlsx, .xls) files are supported."
      });
    }

    // Read Excel file
    const workbook = xlsx.readFile(req.file.path, {
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, {
      raw: false,
      defval: '',
      blankrows: false
    });

    // Validate data size
    if (data.length > CONFIG.MAX_ROWS_IN_MEMORY) {
      return res.status(413).json({
        success: false,
        error: `Dataset too large. Maximum ${CONFIG.MAX_ROWS_IN_MEMORY} rows supported.`
      });
    }

    dataStore.loadData(data, req.file.originalname);

    // Clean up uploaded file
    await fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: "Excel file uploaded and processed successfully",
      rowCount: data.length,
      columns: dataStore.headers,
      columnTypes: dataStore.metadata.columnTypes,
      filename: dataStore.filename,
      sampleData: data.slice(0, 3)
    });

  } catch (error) {
    console.error("Error processing uploaded Excel file:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process Excel file",
      details: error.message
    });
  }
};

export { uploadExcelFile };
