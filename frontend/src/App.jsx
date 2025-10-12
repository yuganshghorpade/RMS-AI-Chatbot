import { useState, useEffect } from 'react'
import { API_BASE_URL } from './utils/api-paths.util.js'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Chatbot from './components/Chatbot.jsx'
import './App.css'

function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('rms_theme')
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  // Theme toggle effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('rms_theme', JSON.stringify(darkMode))
  }, [darkMode])

  // Save chats to localStorage
  useEffect(() => {
    localStorage.setItem('rms_chats', JSON.stringify(chats))
  }, [chats])

  // Save current chat ID to localStorage
  useEffect(() => {
    if (currentChatId) localStorage.setItem('rms_current_chat', currentChatId)
  }, [currentChatId])

  // Helper functions
  const toggleTheme = () => {
    setDarkMode(!darkMode)
  }

  const currentChat = chats.find(c => c.id === currentChatId) || null

  const startNewChat = () => {
    const id = `chat_${Date.now()}`
    const newChat = {
      id,
      title: 'New Chat',
      filename: '',
      createdAt: new Date().toISOString(),
      messages: []
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(id)
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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      {/* Navbar */}
      <Navbar 
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex h-[calc(100vh-20rem)] min-h-[calc(100vh-4rem)]">
        {/* Sidebar - Single instance for both mobile and desktop */}
        <Sidebar
          chats={chats}
          currentChatId={currentChatId}
          setCurrentChatId={setCurrentChatId}
          startNewChat={startNewChat}
          deleteChat={deleteChat}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        {/* Chatbot - takes remaining space */}
        <div className="flex-1">
          <Chatbot
            currentChat={currentChat}
            chats={chats}
            setChats={setChats}
            currentChatId={currentChatId}
            renameChatIfNeeded={renameChatIfNeeded}
            API_BASE_URL={API_BASE_URL}
          />
        </div>
      </div>
    </div>
  )
}

export default App