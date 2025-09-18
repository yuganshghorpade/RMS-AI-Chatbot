import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ApiResponse } from '../utils/api-response.util.js';
import { ApiError } from '../utils/api-error.util.js';
import { extractExcelSchema, saveSchemaAlongsideFile } from '../utils/schema.util.js';
import { buildPrompt } from '../utils/promptgenerator.util.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // Extract schema and save next to file
    const schema = extractExcelSchema(file.path);
    const schemaPath = saveSchemaAlongsideFile(file.path, schema);

    // Get sheet names
    const sheetNames = workbook.SheetNames;
    
    // Get basic file info
    const fileInfo = {
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      path: file.path,
      sheetNames: sheetNames,
      schemaPath,
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
      new ApiResponse(200, { ...fileInfo, schema }, "Excel file uploaded successfully")
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
          const schemaPath = `${filePath}.schema.json`;
          fileList.push({
            filename,
            size: stats.size,
            uploadDate: stats.mtime,
            path: `/temp/${filename}`,
            hasSchema: fs.existsSync(schemaPath)
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

    // Delete schema file if exists
    const schemaPath = `${filePath}.schema.json`;
    if (fs.existsSync(schemaPath)) {
      fs.unlinkSync(schemaPath);
    }

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

export const getSchema = async (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!filename) throw new ApiError(400, 'Filename is required');

    const filePath = path.join(process.cwd(), 'public', 'temp', filename);
    const schemaPath = `${filePath}.schema.json`;

    if (!fs.existsSync(schemaPath)) {
      if (!fs.existsSync(filePath)) throw new ApiError(404, 'File not found');
      // If schema missing but file exists, generate on the fly
      const schema = extractExcelSchema(filePath);
      saveSchemaAlongsideFile(filePath, schema);
      return res.status(200).json(new ApiResponse(200, schema, 'Schema generated'));
    }

    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    return res.status(200).json(new ApiResponse(200, schema, 'Schema retrieved'));
  } catch (error) {
    next(error);
  }
};

export const buildPromptFromSchema = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const { query } = req.body;

    if (!filename) throw new ApiError(400, 'Filename is required');
    if (!query) throw new ApiError(400, 'Query is required');

    const filePath = path.join(process.cwd(), 'public', 'temp', filename);
    if (!fs.existsSync(filePath)) throw new ApiError(404, 'File not found');

    // Build prompt using existing prompt generator (reads file and builds prompt)
    const prompt = buildPrompt(query, filePath);
    return res.status(200).json(new ApiResponse(200, { prompt }, 'Prompt built successfully'));
  } catch (error) {
    next(error);
  }
};

async function generatePythonWithLLM(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiError(501, 'GEMINI_API_KEY not set. Configure LLM or provide code manually.');
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(`Return only Python code. Do not include triple backticks.\n\n${promptText}`);

    let code = result.response.text() || '';
    if (!code.trim()) throw new Error('Empty code from LLM');
    
    // Clean up any markdown formatting that might have slipped through
    code = code.replace(/^```python\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    
    return code;
  } catch (err) {
    throw new ApiError(500, `LLM generation failed: ${err.message}`);
  }
}

function runPythonOnExcel({ excelPath, pythonCode }) {
  return new Promise((resolve) => {
    // Build a full script that loads the Excel as df, then runs the LLM code.
    const script = [
      'import sys, json',
      'import pandas as pd',
      'import warnings',
      'warnings.simplefilter("ignore")',
      '',
      `excel_path = r'''${excelPath}'''`,
      'try:',
      '    df = pd.read_excel(excel_path)',
      'except Exception as e:',
      '    print(json.dumps({"error":"Failed to load Excel: " + str(e)}))',
      '    sys.exit(1)',
      '',
      '# Basic cleanup: strip column names and provide text utils',
      'df.columns = [str(c).strip() for c in df.columns]',
      'def text(x):',
      '    return x.astype(str).str.strip()',
      '',
      '# Ensure output is a string',
      'def output(x):',
      '    return str(x)',
      '',
      '# Ensure output is a string',
      '',
      '# --- BEGIN USER CODE ---',
      pythonCode,
      '# --- END USER CODE ---',
      '',
      '# Ensure something is printed to stdout to surface a result',
      'print("")',
    ].join('\n');

    // Write temp file next to excel
    const tempDir = path.dirname(excelPath);
    const tempPy = path.join(tempDir, `run_${Date.now()}.py`);
    fs.writeFileSync(tempPy, script, 'utf-8');

    // Try invoking Python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(pythonCmd, [tempPy], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', (code) => {
      try { fs.unlinkSync(tempPy); } catch {}
      resolve({ code, stdout, stderr });
    });
  });
}

export const executeQuery = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const { query } = req.body;

    if (!filename) throw new ApiError(400, 'Filename is required');
    if (!query) throw new ApiError(400, 'Query is required');

    const excelPath = path.join(process.cwd(), 'public', 'temp', filename);
    if (!fs.existsSync(excelPath)) throw new ApiError(404, 'File not found');

    // 1) Build the LLM prompt from Excel schema + query
    const promptText = buildPrompt(query, excelPath);

    // console.log(promptText);

    // 2) Ask LLM for Python code (requires GEMINI_API_KEY)
    const pythonCode = await generatePythonWithLLM(promptText);

    console.log(pythonCode);

    // 3) Execute Python code with df preloaded from the Excel
    const result = await runPythonOnExcel({ excelPath, pythonCode });

    console.log(result);

    return res.status(200).json(new ApiResponse(200, {
      prompt: promptText,
      python: pythonCode,
      run: result,
    }, 'Executed Python against Excel'));
  } catch (error) {
    next(error);
  }
};
