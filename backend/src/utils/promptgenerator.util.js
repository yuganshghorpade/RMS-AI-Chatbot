import xlsx from "xlsx";
import fs from "fs";
import path from "path";

/**
 * Detect basic data type from a value
 */
function detectType(value) {
  if (value === null || value === undefined || value === "") return "string";
  if (!isNaN(Date.parse(value)) && value.toString().match(/^\d{4}-\d{2}-\d{2}/)) return "date";
  if (!isNaN(value) && Number.isInteger(Number(value))) return "integer";
  if (!isNaN(value)) return "float";
  return "string";
}

/**
 * Build dynamic prompt for LLM
 * @param {string} userQuery - The natural language question from the user
 * @param {string} filePath - Path to the uploaded Excel file
 * @returns {string} The generated LLM prompt
 */
export function buildPrompt(userQuery, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error("Excel file not found at " + filePath);
  }

  // Read Excel
  const workbook = xlsx.readFile(filePath, {
    cellDates: true,
    cellNF: false,
    cellText: false
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { raw: false, defval: "" });

  if (data.length === 0) {
    throw new Error("Excel file has no data");
  }

  // Extract schema
  const firstRow = data[0];
  const columns = Object.keys(firstRow).map(col => ({
    name: col,
    type: detectType(firstRow[col])
  }));

  // Get sample rows
  const sampleData = data.slice(0, 3);

  // Create prompt
  const prompt = `
You are a data query assistant. 
The dataset has the following columns and types:
${columns.map(c => `- ${c.name} (${c.type})`).join("\n")}

Here are 3 example rows from the dataset:
${JSON.stringify(sampleData, null, 2)}

The user has asked: "${userQuery}"

Write Python code using Pandas to answer the question, assuming the dataset is loaded in a DataFrame named 'df'.
Only output the Python code without explanations.
  `.trim();

  return prompt;
}
