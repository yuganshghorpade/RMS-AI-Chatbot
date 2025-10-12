import { useState, useEffect } from 'react'
import { API_BASE_URL } from './utils/api-paths.util.js'
import DataVisualization from './components/DataVisualization.jsx'

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
  const [sending, setSending] = useState(false)

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
    if (e.type === "dragenter" || e.type === "dragleave" || e.type === "dragover") {
      setDragActive(e.type !== 'dragleave')
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

  const tryParseJson = (text) => {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed
      return null
    } catch {
      return null
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
    setSending(true)

    // insert a temporary loading assistant message
    const tempId = `loading_${Date.now()}`
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, { role: 'assistant', content: 'Loading...', isLoading: true, tempId }] } : c))

    try {
      const response = await fetch(`http://localhost:4000/api/v1/file/execute/${encodeURIComponent(currentChat.filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg.content })
      })
      const result = await response.json()
      if (response.ok) {
        const run = result.data.run
        const onlyStdout = (run.stdout || '').trim()
        const maybeJson = tryParseJson(onlyStdout)
        if (maybeJson) {
          // replace loading message with table message
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.isLoading && m.tempId === tempId ? { role: 'assistant', content: maybeJson, isJson: true, userQuestion: userMsg.content } : m) } : c))
        } else {
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.isLoading && m.tempId === tempId ? { role: 'assistant', content: onlyStdout || '(empty)' } : m) } : c))
        }
      } else {
        const errText = `Error: ${result.message || 'Failed to execute'}`
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.isLoading && m.tempId === tempId ? { role: 'assistant', content: errText } : m) } : c))
      }
    } catch (error) {
      const errText = `Error: ${error.message}`
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.isLoading && m.tempId === tempId ? { role: 'assistant', content: errText } : m) } : c))
    } finally {
      setSending(false)
    }
  }

  const TableMessage = ({ rows, userQuestion }) => {
    const [page, setPage] = useState(1)
    const [showGraph, setShowGraph] = useState(false)
    const pageSize = 10
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
    
    // Check if the user's question suggests they want visualization
    const chartKeywords = /chart|graph|distribution|visualize|plot|show.*chart|create.*chart|display.*graph/i;
    const shouldShowChartButton = userQuestion && chartKeywords.test(userQuestion);

    useEffect(() => {
      if (page > totalPages) setPage(totalPages)
    }, [rows, totalPages])

    if (!rows.length) return <div>empty table</div>

    const columns = Object.keys(rows[0] || {})
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const pageRows = rows.slice(start, end)

    const buildPageList = () => {
      const items = []
      const maxVisible = 7
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) items.push(i)
        return items
      }
      const showLeft = 2
      const showRight = 1
      const around = 1
      const left = [1, 2]
      const right = [totalPages]
      const middleStart = Math.max(3, page - around)
      const middleEnd = Math.min(totalPages - 1, page + around)

      items.push(...left)
      if (middleStart > left[left.length - 1] + 1) items.push('...')
      for (let i = middleStart; i <= middleEnd; i++) items.push(i)
      if (middleEnd < totalPages - 1) items.push('...')
      items.push(...right)
      return items.filter((v, idx, arr) => !(v === '...' && arr[idx - 1] === '...'))
    }

    const pageItems = buildPageList()

    return (
      <div>
        {/* Show Graph Button - only show if user asked for visualization */}
        {shouldShowChartButton && (
          <div className="mb-3 flex justify-between items-center">
            <span className="text-sm text-gray-600">📊 Data Table</span>
            <button
              onClick={() => setShowGraph(!showGraph)}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              {showGraph ? '📊 Hide Graph' : '📈 Show Graph'}
            </button>
          </div>
        )}
        
        {/* Always show table title if no chart button */}
        {!shouldShowChartButton && (
          <div className="mb-3">
            <span className="text-sm text-gray-600">📊 Data Table</span>
          </div>
        )}

        <div className="block w-full overflow-x-auto mt-2">
          <table className="border-collapse bg-white w-auto min-w-full">
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c} className="border border-gray-300 px-3 py-2 text-left whitespace-nowrap min-w-[100px] bg-gray-50 font-bold sticky top-0 z-10">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                  {columns.map(c => (
                    <td key={c} className="border border-gray-300 px-3 py-2 text-left whitespace-nowrap min-w-[100px]">
                      {String(r[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 py-2 flex-wrap">
          <button 
            className="bg-gray-100 border border-gray-300 px-2 py-1 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1}
          >
            Prev
          </button>
          <div className="flex items-center gap-1">
            {pageItems.map((it, idx) => (
              it === '...'
                ? <span key={idx} className="text-gray-500 px-1">...</span>
                : <button
                    key={idx}
                    className={`px-2 py-1 rounded cursor-pointer border ${it === page ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-300'}`}
                    onClick={() => setPage(it)}
                  >{it}</button>
            ))}
          </div>
          <button 
            className="bg-gray-100 border border-gray-300 px-2 py-1 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page === totalPages}
          >
            Next
          </button>
          <span className="text-gray-700 font-semibold">Page {page} / {totalPages}</span>
        </div>

        {/* Show/Hide Graph Section */}
        {showGraph && <DataVisualization data={rows} userQuestion={userQuestion} />}
      </div>
    )
  }

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault()
      sendMessage()
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
    <div className="min-h-screen p-5 bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="max-w-7xl mx-auto bg-white bg-opacity-95 rounded-3xl shadow-2xl backdrop-blur-lg overflow-hidden grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="hidden lg:block border-r border-gray-200 bg-gray-50 p-4">
          <button 
            className="w-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none py-2 px-3 rounded-lg font-semibold cursor-pointer hover:shadow-lg transition-all"
            onClick={startNewChat}
          >
            + New Chat
          </button>
          <div className="mt-3 flex flex-col gap-2">
            {chats.length === 0 && (
              <div className="text-gray-500 text-center p-2">No chats yet</div>
            )}
            {chats.map(chat => (
              <div 
                key={chat.id} 
                className={`flex items-center justify-between py-2 px-2 rounded-lg cursor-pointer bg-white border ${currentChatId === chat.id ? 'border-indigo-500 shadow-md' : 'border-gray-300'}`}
                onClick={() => setCurrentChatId(chat.id)}
              >
                <div className="text-sm text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                  {chat.title || 'New Chat'}
                </div>
                <button 
                  className="bg-transparent border-none cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="bg-white">
          <header className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white py-10 px-10 text-center">
            <h1 className="text-4xl mb-2 font-bold">📊 Excel Chat</h1>
            <p className="text-lg opacity-90">One Excel per chat. Create a new chat for another file.</p>
            {currentChat?.filename ? (
              <div className="mt-3 inline-flex items-center gap-2 bg-gray-100 border border-gray-300 rounded-full py-1 px-2">
                <span className="text-sm text-gray-800">{currentChat.filename}</span>
                <button 
                  className="bg-transparent border-none cursor-pointer text-blue-600 font-bold"
                  onClick={() => handleDownload(currentChat.filename)}
                >
                  Download
                </button>
              </div>
            ) : null}
          </header>

          {/* Upload Section: hide entirely once a file is attached */}
          {!currentChat?.filename && (
            <section className="py-10 px-10 border-b border-gray-200">
              <h2 className="text-3xl mb-8 text-gray-800 text-center">Upload Excel File</h2>
              <div 
                className={`border-3 border-dashed rounded-2xl py-16 px-5 text-center transition-all cursor-pointer ${dragActive ? 'border-indigo-500 bg-teal-50 scale-105' : 'border-gray-300 bg-gray-50 hover:border-indigo-500 hover:bg-gray-100'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="max-w-md mx-auto">
                  <div className="text-6xl mb-5 animate-bounce">📁</div>
                  <p className="mb-4 text-gray-600 text-lg">Drag and drop your Excel file here, or click to browse</p>
                  <p className="text-sm text-gray-500 italic mb-4">Supported formats: .xlsx, .xls, .xlsm, .xltm (Max: 10MB)</p>
                  
                  <input
                    type="file"
                    id="fileInput"
                    accept=".xlsx,.xls,.xlsm,.xltm"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <button 
                    className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none py-3 px-8 rounded-full text-base font-semibold cursor-pointer transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    onClick={() => document.getElementById('fileInput').click()}
                  >
                    Choose File
                  </button>
                </div>
              </div>

              {selectedFile && (
                <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-200">
                  <h3 className="mb-5 text-gray-800 text-xl">Selected File:</h3>
                  <div className="mb-5">
                    <p className="mb-2 text-gray-600"><strong>Name:</strong> {selectedFile.name}</p>
                    <p className="text-gray-600"><strong>Type:</strong> {selectedFile.type || 'Unknown'}</p>
                  </div>
                  <button 
                    className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none py-3 px-6 rounded-full text-base font-semibold cursor-pointer transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </button>
                </div>
              )}

              {message && (
                <div className={`mt-5 py-3 px-5 rounded-lg font-medium text-center ${message.includes('Error') ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                  {message}
                </div>
              )}
            </section>
          )}

          {/* Chat Section */}
          <section className="py-5 px-10 border-t border-gray-200">
            <div className="min-h-[160px] flex flex-col gap-3">
              {currentChat?.messages?.length ? (
                currentChat.messages.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-[90px_1fr] gap-2 items-start">
                    <div className="font-bold text-black">{m.role}</div>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg py-3 px-3 overflow-x-auto whitespace-pre-wrap break-words text-gray-900">
                      {m.isJson ? <TableMessage rows={m.content} userQuestion={m.userQuestion} /> : m.content}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-10">Ask something about your uploaded Excel here.</div>
              )}
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-2 mt-2">
              <input
                type="text"
                placeholder={currentChat?.filename ? 'Ask a question about your Excel...' : 'Upload an Excel to start asking...'}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                disabled={!currentChat?.filename || sending}
                className="py-3 px-3 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button 
                className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none rounded-lg font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={sendMessage} 
                disabled={!currentChat?.filename || !userInput.trim() || sending}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App