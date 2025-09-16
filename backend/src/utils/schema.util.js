import xlsx from "xlsx";
import fs from "fs";
import path from "path";

function detectType(value) {
  if (value === null || value === undefined || value === "") return "string";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "float";
  if (!isNaN(Date.parse(value)) && value.toString().match(/^\d{4}-\d{2}-\d{2}/)) return "date";
  if (!isNaN(Number(value)) && Number.isInteger(Number(value))) return "integer";
  if (!isNaN(Number(value))) return "float";
  return "string";
}

export function extractExcelSchema(filePath) {
  const workbook = xlsx.readFile(filePath, {
    cellDates: true,
    cellNF: false,
    cellText: false
  });

  const schema = {
    filePath,
    sheets: []
  };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { raw: false, defval: "" });

    let columns = [];
    if (rows.length > 0) {
      const firstRow = rows[0];
      columns = Object.keys(firstRow).map((col) => ({
        name: col,
        type: detectType(firstRow[col])
      }));
    }

    schema.sheets.push({
      name: sheetName,
      columns,
      totalRows: rows.length,
      sampleRows: rows.slice(0, 5)
    });
  }

  return schema;
}

export function saveSchemaAlongsideFile(filePath, schema) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const schemaFilename = `${base}.schema.json`;
  const schemaPath = path.join(dir, schemaFilename);
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), "utf-8");
  return schemaPath;
}
