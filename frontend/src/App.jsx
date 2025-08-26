import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from './utils/api-paths.util.js'; // custom config file
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/v1/file/files`);
      setFiles(data.data || []);
    } catch (error) {
      // console.error(error);
      setMessage(`Error loading files: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.template.macroEnabled.12'
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.xlsm', '.xltm'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setMessage('Error: Only Excel files (.xlsx, .xls, .xlsm, .xltm) are allowed');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage('Error: File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a file first');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('excelFile', selectedFile);

      const { data } = await axios.post(`${API_BASE_URL}/api/v1/file/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage(`Success: ${data.message}`);
      setSelectedFile(null);
      document.getElementById('fileInput').value = '';
      loadFiles();
    } catch (error) {
      console.log(error);
      setMessage(`Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (filename) => {
    window.open(`${API_BASE_URL}/api/v1/file/download/${filename}`, '_blank');
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
      const { data } = await axios.delete(`${API_BASE_URL}/api/v1/file/delete/${filename}`);
      setMessage(`Success: ${data.message}`);
      loadFiles();
    } catch (error) {
      setMessage(`Error: ${error.response?.data?.message || error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString();

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>📊 Excel File Upload System</h1>
          <p>Upload, manage, and process Excel files with ease</p>
        </header>

        {/* File Upload Section */}
        <section className="upload-section">
          <h2>Upload Excel File</h2>
          
          <div 
            className={`drag-drop-area ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="drag-content">
              <div className="upload-icon">📁</div>
              <p>Drag and drop your Excel file here, or click to browse</p>
              <p className="file-types">Supported formats: .xlsx, .xls, .xlsm, .xltm (Max: 10MB)</p>
              
              <input
                type="file"
                id="fileInput"
                accept=".xlsx,.xls,.xlsm,.xltm"
                onChange={handleFileSelect}
                className="file-input"
              />
              
              <button 
                className="browse-btn"
                onClick={() => document.getElementById('fileInput').click()}
              >
                Choose File
              </button>
            </div>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="file-info">
              <h3>Selected File:</h3>
              <div className="file-details">
                <p><strong>Name:</strong> {selectedFile.name}</p>
                <p><strong>Size:</strong> {formatFileSize(selectedFile.size)}</p>
                <p><strong>Type:</strong> {selectedFile.type || 'Unknown'}</p>
              </div>
              <button 
                className="upload-btn"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
        </section>

        {/* Files List Section */}
        <section className="files-section">
          <div className="section-header">
            <h2>Uploaded Files</h2>
            <button className="refresh-btn" onClick={loadFiles}>
              🔄 Refresh
            </button>
          </div>

          {files.length === 0 ? (
            <div className="no-files">
              <p>No files uploaded yet.</p>
              <p>Upload your first Excel file to get started!</p>
            </div>
          ) : (
            <div className="files-grid">
              {files.map((file, index) => (
                <div key={index} className="file-card">
                  <div className="file-header">
                    <div className="file-icon">📊</div>
                    <div className="file-name">{file.filename}</div>
                  </div>
                  
                  <div className="file-details">
                    <p><strong>Size:</strong> {formatFileSize(file.size)}</p>
                    <p><strong>Uploaded:</strong> {formatDate(file.uploadDate)}</p>
                  </div>
                  
                  <div className="file-actions">
                    <button 
                      className="action-btn download-btn"
                      onClick={() => handleDownload(file.filename)}
                    >
                      📥 Download
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => handleDelete(file.filename)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default App;
