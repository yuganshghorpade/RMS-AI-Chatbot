import { useState, useEffect, useRef } from 'react'
import DataVisualization from './DataVisualization.jsx'

const Chatbot = ({ 
  currentChat, 
  chats, 
  setChats, 
  currentChatId, 
  renameChatIfNeeded,
  API_BASE_URL 
}) => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentChat?.messages])

  // File upload functions
  const validateAndSetFile = (file) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.template.macroEnabled.12'
    ]
    
    const allowedExtensions = ['.xlsx', '.xls', '.xlsm', '.xltm']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setMessage('Error: Only Excel files (.xlsx, .xls, .xlsm, .xltm) are allowed')
      return
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
      setMessage('Error: File size must be less than 10MB')
      return
    }

    if (currentChat && currentChat.filename) {
      setMessage('This chat already has an Excel. Please start a new chat to upload a different file.')
      return
    }
    
    setSelectedFile(file)
    setMessage('')
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

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a file first')
      return
    }

    const chatId = currentChatId
    if (!chatId) {
      setMessage('Please start a new chat first')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('excelFile', selectedFile)

      const response = await fetch(`${API_BASE_URL}/api/v1/file/upload`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(`Success: ${result.message}`)
        setSelectedFile(null)
        const uploadedFilename = result.data.filename
        renameChatIfNeeded(chatId, uploadedFilename)
        
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
      window.open(`${API_BASE_URL}/api/v1/file/download/${filename}`, '_blank')
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

    const tempId = Date.now()
    const loadingMsg = { role: 'assistant', content: 'Analyzing your request...', isLoading: true, tempId }
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, loadingMsg] } : c))

    setUserInput('')
    setSending(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/file/execute/${encodeURIComponent(currentChat.filename)}`, {
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
          const assistantMsg = { role: 'assistant', content: maybeJson, isJson: true, userQuestion: userMsg.content }
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.isLoading && m.tempId === tempId ? assistantMsg : m) } : c))
        } else {
          const assistantMsg = { role: 'assistant', content: onlyStdout || '(empty)' }
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.isLoading && m.tempId === tempId ? assistantMsg : m) } : c))
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

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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

  // Table component for displaying JSON results
  const TableMessage = ({ rows, userQuestion }) => {
    const [page, setPage] = useState(1)
    const [showGraph, setShowGraph] = useState(false)
    const pageSize = 10
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
    
    const chartKeywords = /chart|graph|distribution|visualize|plot|show.*chart|create.*chart|display.*graph/i
    const shouldShowChartButton = userQuestion && chartKeywords.test(userQuestion)

    useEffect(() => {
      if (page > totalPages) setPage(totalPages)
    }, [rows, totalPages])

    if (!rows.length) return <div className="text-gray-500">Empty table</div>

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
      const left = [1, 2]
      const right = [totalPages]
      const around = 1
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
      <div className="space-y-4">
        {shouldShowChartButton && (
          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              📊 Data Visualization Available
            </span>
            <button
              onClick={() => setShowGraph(!showGraph)}
              className="bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 border-none py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 hover:shadow-md"
            >
              {showGraph ? '📊 Hide Graph' : '📈 Show Graph'}
            </button>
          </div>
        )}
        
        {/* Table Container with proper responsiveness and scrollbars */}
        <div className="table-container bg-white p-3 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden w-[90%]" style={{ maxWidth: '1100px', width: 'fit-content' }}>
          {/* Horizontal scroll container with controlled width */}
          <div className="table-scroll overflow-x-auto overflow-y-auto" style={{ maxHeight: '70vh' }}>
            <table className="border-collapse" style={{ minWidth: '800px' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  {columns.map(c => (
                    <th 
                      key={c} 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
                      title={c}
                      style={{ minWidth: '100px', maxWidth: '200px' }}
                    >
                      <div className="truncate">{c}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {pageRows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    {columns.map(c => (
                      <td 
                        key={c} 
                        className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap"
                        title={String(r[c] ?? '')}
                        style={{ minWidth: '100px', maxWidth: '200px' }}
                      >
                        <div className="truncate">
                          {String(r[c] ?? '')}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2">
                <button 
                  className="px-3 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {pageItems.map((it, idx) => (
                    it === '...'
                      ? <span key={idx} className="px-2 text-gray-500">...</span>
                      : <button
                          key={idx}
                          className={`px-3 py-1 text-sm rounded border ${
                            it === page 
                              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white' 
                              : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500'
                          }`}
                          onClick={() => setPage(it)}
                        >{it}</button>
                  ))}
                </div>
                
                <button 
                  className="px-3 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
              
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {page} of {totalPages} • {rows.length} rows
              </span>
            </div>
          )}
        </div>

        {showGraph && <DataVisualization data={rows} userQuestion={userQuestion} />}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {currentChat?.filename ? `📄 ${currentChat.filename}` : '📊 Excel Chat AI'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentChat?.filename 
                ? 'Ask questions about your Excel data using natural language'
                : 'Upload an Excel file to start analyzing your data'
              }
            </p>
          </div>
          {currentChat?.filename && (
            <button 
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
              onClick={() => handleDownload(currentChat.filename)}
            >
              Download
            </button>
          )}
        </div>
      </div>

      {/* Upload Section - only show if no file is uploaded */}
      {!currentChat?.filename && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
            Upload Excel File
          </h3>
          
          <div 
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
              dragActive 
                ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-800 scale-[1.02]' 
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-6 animate-bounce-slow">📁</div>
              <p className="mb-4 text-gray-700 dark:text-gray-300 text-lg font-medium">
                Drag and drop your Excel file here
              </p>
              <p className="mb-6 text-gray-600 dark:text-gray-400">or click to browse</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 italic mb-6">
                Supported formats: .xlsx, .xls, .xlsm, .xltm (Max: 10MB)
              </p>
              
              <input
                type="file"
                id="fileInput"
                accept=".xlsx,.xls,.xlsm,.xltm"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <button 
                className="bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 border-none py-3 px-8 rounded-xl text-lg font-semibold cursor-pointer transition-all duration-300 shadow-lg hover:shadow-glow hover:-translate-y-1"
                onClick={() => document.getElementById('fileInput').click()}
              >
                Choose File
              </button>
            </div>
          </div>

          {selectedFile && (
            <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-600">
              <h4 className="mb-4 text-gray-900 dark:text-white text-lg font-semibold">Selected File</h4>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Name:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{selectedFile.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Size:</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatFileSize(selectedFile.size)}</span>
                </div>
              </div>
              <button 
                className={`bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 border-none py-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 shadow-lg hover:shadow-glow hover:-translate-y-1 ${
                  uploading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
            </div>
          )}

          {message && (
            <div className={`mt-6 py-3 px-4 rounded-lg font-medium text-center ${
              message.includes('Error') 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800' 
                : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
            }`}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Chat Section */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Messages Area - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 chat-messages-container" style={{ maxHeight: 'calc(100vh - 145px)' }}>
          {currentChat?.messages?.length ? (
            currentChat.messages.map((m, idx) => (
              <div key={idx} className="group animate-slide-up">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    m.role === 'user' 
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' 
                      : m.role === 'assistant'
                      ? 'bg-gray-600 dark:bg-gray-300 text-white dark:text-gray-900'
                      : 'bg-gray-400 dark:bg-gray-500 text-white'
                  }`}>
                    {m.role === 'user' ? '👤' : m.role === 'assistant' ? '🤖' : '⚙️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-700 dark:text-gray-300 capitalize">
                        {m.role === 'assistant' ? 'AI Assistant' : m.role === 'user' ? 'You' : 'System'}
                      </span>
                      {m.isLoading && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      )}
                    </div>
                    <div className={`p-4 rounded-2xl border transition-all duration-200 chat-message-content ${
                      m.role === 'user'
                        ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 ml-4'
                        : m.role === 'assistant'
                        ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    } ${m.isJson ? 'overflow-hidden' : ''}`}>
                      <div className={`text-gray-900 dark:text-gray-100 ${m.isJson ? '' : 'whitespace-pre-wrap break-words'}`}>
                        {m.isJson ? <TableMessage rows={m.content} userQuestion={m.userQuestion} /> : m.content}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4 animate-pulse-slow">💬</div>
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Start a conversation</h3>
              <p className="text-gray-500 dark:text-gray-500">
                {currentChat?.filename 
                  ? 'Ask questions about your Excel data using natural language'
                  : 'Upload an Excel file to begin analyzing your data'
                }
              </p>
            </div>
          )}
          {/* Auto-scroll target */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Section - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder={currentChat?.filename ? 'Ask a question about your Excel data...' : 'Upload an Excel file to start asking questions...'}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                disabled={!currentChat?.filename || sending}
                className="w-full p-2 rounded-2xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-gray-900 dark:focus:border-white focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              />
            </div>
            <button 
              className={`p-2 rounded-2xl font-bold cursor-pointer transition-all duration-300 text-lg flex items-center gap-2 ${
                !currentChat?.filename || !userInput.trim() || sending
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 shadow-lg hover:shadow-glow hover:-translate-y-1'
              }`}
              onClick={sendMessage} 
              disabled={!currentChat?.filename || !userInput.trim() || sending}
            >
              {sending ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  Send
                  <span className="text-xl">→</span>
                </>
              )}
            </button>
          </div>
         
        </div>
      </div>
    </div>
  )
}

export default Chatbot