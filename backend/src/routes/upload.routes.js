import express from 'express';
import { upload } from '../middleware/multer.middleware.js';
import {
  uploadExcelFile,
  getUploadedFiles,
  deleteFile,
  downloadFile
} from '../controllers/uploadfile.controller.js';

const router = express.Router();

// Route to upload Excel file
router.post('/upload', upload.single('excelFile'), uploadExcelFile);

// Route to get list of uploaded files
router.get('/files', getUploadedFiles);

// Route to download a specific file
router.get('/download/:filename', downloadFile);

// Route to delete a specific file
router.delete('/delete/:filename', deleteFile);

export default router;
