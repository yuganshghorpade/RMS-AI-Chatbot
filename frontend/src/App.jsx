import { useState, useEffect } from 'react'
import './App.css'
import { API_BASE_URL } from './utils/api-paths.util.js'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)

  // Chat state
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem('rms_chats')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [currentChatId, setCurrentChatId] = useState(() => {
    try {
      const saved = localStorage.getItem('rms_current_chat')
      return saved || ''
    } catch {
      return ''
    }
  })
  const [userInput, setUserInput] = useState('')

  const UPLOAD_API = `${API_BASE_URL}/api/v1/upload`

  useEffect(() => {
    // no-op: no global files list anymore
  }, [])

  useEffect(() => {
    localStorage.setItem('rms_chats', JSON.stringify(chats))
  }, [chats])

  useEffect(() => {
    if (currentChatId) localStorage.setItem('rms_current_chat', currentChatId)
  }, [currentChatId])

  const currentChat = chats.find(c => c.id === currentChatId) || null

  const startNewChat = () => {
    const id = `chat_${Date.now()}`
    const newChat = {
      id,
      title: 'New Chat',
      filename: '', // will be set after upload
      createdAt: new Date().toISOString(),
      messages: []
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(id)
    setSelectedFile(null)
    setUserInput('')
    setMessage('')
  }

  const deleteChat = (id) => {
    setChats(prev => prev.filter(c => c.id !== id))
    if (currentChatId === id) {
      setCurrentChatId('')
    }
  }

  const renameChatIfNeeded = (chatId, filename) => {
    setChats(prev => prev.map(c => c.id === chatId ? {
      ...c,
      title: filename,
      filename
    } : c))
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      validateAndSetFile(file)
    }
  }

  const validateAndSetFile = (file) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.template.macroEnabled.12'
    ]
    
    const allowedExtensions = ['.xlsx', '.xls', '.xlsm', '.xltm']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.') )
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setMessage('Error: Only Excel files (.xlsx, .xls, .xlsm, .xltm) are allowed')
      return
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
      setMessage('Error: File size must be less than 10MB')
      return
    }

    // Enforce one Excel per chat
    if (currentChat && currentChat.filename) {
      setMessage('This chat already has an Excel. Please start a new chat to upload a different file.')
      return
    }
    
    setSelectedFile(file)
    setMessage('')
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a file first')
      return
    }

    // Ensure a chat exists
    if (!currentChat) {
      startNewChat()
    }

    const chatId = currentChatId || `chat_${Date.now()}`
    if (!currentChatId) {
      setCurrentChatId(chatId)
      setChats(prev => [{ id: chatId, title: 'New Chat', filename: '', createdAt: new Date().toISOString(), messages: []}, ...prev])
    }

    setUploading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('excelFile', selectedFile)

      const response = await fetch(`http://localhost:4000/api/v1/file/upload`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(`Success: ${result.message}`)
        setSelectedFile(null)
        const uploadedFilename = result.data.filename
        renameChatIfNeeded(chatId, uploadedFilename)
        // Add a system message with schema summary
        const schema = result.data.schema
        const sysMsg = {
          role: 'system',
          content: `Excel uploaded: ${uploadedFilename}. Sheets: ${schema.sheets.map(s=>s.name).join(', ')}`
        }
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, sysMsg] } : c))
      } else {
        setMessage(`Error: ${result.message || 'Upload failed'}`)
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (filename) => {
    try {
      window.open(`http://localhost:4000/api/v1/file/download/${filename}`, '_blank')
    } catch (error) {
      setMessage(`Download failed: ${error.message}`)
    }
  }

  const sendMessage = async () => {
    if (!currentChat || !currentChat.filename) {
      setMessage('Upload an Excel in this chat before asking a question.')
      return
    }
    if (!userInput.trim()) return

    const chatId = currentChat.id

    const userMsg = { role: 'user', content: userInput.trim() }
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, userMsg] } : c))
    setUserInput('')

    try {
      const response = await fetch(`http://localhost:4000/api/v1/file/execute/${encodeURIComponent(currentChat.filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg.content })
      })
      const result = await response.json()
      if (response.ok) {
        const prompt = result.data.prompt
        const python = result.data.python
        const run = result.data.run
        console.log('Prompt built for LLM:\n', prompt)
        console.log('Generated Python:\n', python)
        console.log('Python execution result:', run)
        const onlyStdout = (run.stdout || '').trim()
        console.log('Only stdout:', onlyStdout)
        const assistantMsg = { role: 'assistant', content: onlyStdout || '(empty)' }
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, assistantMsg] } : c))
      } else {
        const errMsg = { role: 'assistant', content: `Error: ${result.message || 'Failed to execute'}` }
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errMsg] } : c))
      }
    } catch (error) {
      console.log(error);
      const errMsg = { role: 'assistant', content: `Error: ${error.message}` }
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errMsg] } : c))
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="app">
      <div className="container layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <button className="new-chat-btn" onClick={startNewChat}>+ New Chat</button>
          <div className="chat-list">
            {chats.length === 0 && (
              <div className="empty">No chats yet</div>
            )}
            {chats.map(chat => (
              <div key={chat.id} className={`chat-item ${currentChatId === chat.id ? 'active' : ''}`} onClick={() => setCurrentChatId(chat.id)}>
                <div className="chat-title">{chat.title || 'New Chat'}</div>
                <button className="chat-delete" onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }}>🗑️</button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="main">
          <header className="header">
            <h1>📊 Excel Chat</h1>
            <p>One Excel per chat. Create a new chat for another file.</p>
            {currentChat?.filename ? (
              <div className="file-chip">
                <span className="file-name">{currentChat.filename}</span>
                <button className="chip-action" onClick={() => handleDownload(currentChat.filename)}>Download</button>
              </div>
            ) : null}
          </header>

          {/* Upload Section: hide entirely once a file is attached */}
          {!currentChat?.filename && (
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

              {selectedFile && (
                <div className="file-info">
                  <h3>Selected File:</h3>
                  <div className="file-details">
                    <p><strong>Name:</strong> {selectedFile.name}</p>
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

              {message && (
                <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                  {message}
                </div>
              )}
            </section>
          )}

          {/* Chat Section */}
          <section className="chat-section">
            <div className="messages">
              {currentChat?.messages?.length ? (
                currentChat.messages.map((m, idx) => (
                  <div key={idx} className={`msg ${m.role}`}>
                    <div className="role">{m.role}</div>
                    <div className="content prewrap">{m.content}</div>
                  </div>
                ))
              ) : (
                <div className="no-msgs">Ask something about your uploaded Excel here.</div>
              )}
            </div>

            <div className="input-row">
              <input
                type="text"
                placeholder={currentChat?.filename ? 'Ask a question about your Excel...' : 'Upload an Excel to start asking...'}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={!currentChat?.filename}
              />
              <button className="send-btn" onClick={sendMessage} disabled={!currentChat?.filename || !userInput.trim()}>Send</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
