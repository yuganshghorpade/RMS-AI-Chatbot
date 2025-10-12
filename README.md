# RMS-AI-Chatbot 📊

An intelligent chatbot application that allows users to upload Excel files and query them using natural language. The system uses Google Gemini AI to generate Python code that analyzes Excel data and provides insights.

## 🚀 Features

- **Excel File Upload**: Support for multiple Excel formats (.xlsx, .xls, .xlsm, .xltm)
- **Schema Extraction**: Automatic schema detection and storage for uploaded files
- **Natural Language Queries**: Ask questions about your Excel data in plain English
- **AI-Powered Analysis**: Uses Google Gemini AI to generate Python code for data analysis
- **Chat Interface**: Multi-chat system with file management per chat
- **Real-time Results**: Execute Python code against Excel data and get instant results
- **File Management**: Upload, download, and delete Excel files
- **Data Visualization**: Results displayed in tables and formatted output

## 🏗️ Architecture

### Backend (Node.js + Express)
- **API Server**: RESTful API with file upload and query execution endpoints
- **File Processing**: Excel file parsing using XLSX library
- **AI Integration**: Google Generative AI for Python code generation
- **Schema Management**: Automatic extraction and storage of Excel file schemas

### Frontend (React + Vite)
- **Modern UI**: React-based interface with drag-and-drop file upload
- **Chat System**: Multiple chat sessions with file associations
- **Real-time Interaction**: Instant query execution and result display
- **Responsive Design**: Works across different screen sizes

## 📋 Prerequisites

- Node.js (v16 or higher)
- Python 3.x (for executing generated code)
- Google Gemini API Key
- npm or yarn

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yuganshghorpade/RMS-AI-Chatbot.git
cd RMS-AI-Chatbot
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
PORT=4000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

### 4. Python Dependencies
Ensure Python is installed with pandas:
```bash
pip install pandas openpyxl xlrd
```

## 🚀 Running the Application

### Start Backend Server
```bash
cd backend
npm start
```
The backend will run on `http://localhost:4000`

### Start Frontend Development Server
```bash
cd frontend
npm run dev
```
The frontend will run on `http://localhost:5173`

## 📖 Usage

### 1. Upload Excel File
- Start a new chat session
- Drag and drop an Excel file or click to browse
- Supported formats: .xlsx, .xls, .xlsm, .xltm (Max: 10MB)

### 2. Query Your Data
Once uploaded, you can ask questions like:
- "What is the total sales for this month?"
- "Show me the top 10 customers by revenue"
- "Calculate the average order value"
- "Find all orders above $1000"

### 3. View Results
- Results are displayed in an easy-to-read format
- Tables are automatically formatted for better visualization
- Error messages are shown if queries fail

## 🔧 API Endpoints

### File Upload
- `POST /api/v1/upload/upload` - Upload Excel file
- `GET /api/v1/upload/files` - List uploaded files
- `DELETE /api/v1/upload/:filename` - Delete file
- `GET /api/v1/upload/download/:filename` - Download file

### Data Analysis
- `GET /api/v1/upload/schema/:filename` - Get file schema
- `POST /api/v1/upload/prompt/:filename` - Build prompt from schema
- `POST /api/v1/upload/execute/:filename` - Execute natural language query

## 🧠 How It Works

1. **File Upload**: User uploads an Excel file
2. **Schema Extraction**: System analyzes the file structure and creates a schema
3. **Query Processing**: User asks a question in natural language
4. **Prompt Generation**: System builds a comprehensive prompt with schema and query
5. **AI Code Generation**: Google Gemini generates Python code to analyze the data
6. **Code Execution**: Python script runs with pandas DataFrame loaded from Excel
7. **Result Display**: Output is formatted and displayed to the user

## 📁 Project Structure

```
RMS-AI-Chatbot/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── uploadfile.controller.js
│   │   ├── middleware/
│   │   │   └── multer.middleware.js
│   │   ├── routes/
│   │   │   └── upload.routes.js
│   │   ├── utils/
│   │   │   ├── api-error.util.js
│   │   │   ├── api-response.util.js
│   │   │   ├── promptgenerator.util.js
│   │   │   └── schema.util.js
│   │   ├── app.js
│   │   └── index.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── utils/
│   │   │   └── api-paths.util.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   └── package.json
└── README.md
```

## 🔒 Environment Variables

### Backend (.env)
```env
GEMINI_API_KEY=your_google_gemini_api_key
PORT=4000
```

## 🛡️ Security Features

- File type validation (Excel files only)
- File size limits (10MB max)
- Input sanitization
- Error handling and logging
- Temporary file cleanup

## 🐛 Troubleshooting

### Common Issues

1. **Python not found**: Ensure Python is installed and available in PATH
2. **Pandas import error**: Install pandas with `pip install pandas openpyxl`
3. **API key error**: Verify your Google Gemini API key is correct
4. **File upload fails**: Check file format and size limits
5. **CORS errors**: Ensure backend is running on port 4000

### Error Messages
- `No file uploaded`: Select a valid Excel file
- `Invalid file type`: Use only Excel formats (.xlsx, .xls, .xlsm, .xltm)
- `File too large`: Keep files under 10MB
- `GEMINI_API_KEY not set`: Add your API key to .env file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

- **Yugansh Ghorpade** - *Initial work* - [yuganshghorpade](https://github.com/yuganshghorpade)

- **Tejas Dherange** - *Initial work* - [tejasdherange](https://github.com/Tejas-Dherange)

- **Tejas Divekar** - *Initial work* - [tejasdivekar](https://github.com/TejasD-13)

- **Soham Zinjurke** - *Initial work* - [sohamzinjurke](https://github.com/SohamZinjurke)
## 🙏 Acknowledgments

- Google Generative AI for natural language processing
- React team for the frontend framework
- Express.js for the backend framework
- XLSX library for Excel file processing
- Multer for file upload handling

## 📞 Support

If you have any questions or need help, please:
1. Check the troubleshooting section
2. Open an issue on GitHub
3. Contact the development team

---

Built with ❤️ for Forbes Marshall's Resource Management System