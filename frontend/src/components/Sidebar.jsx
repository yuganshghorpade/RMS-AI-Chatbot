const Sidebar = ({ 
  chats, 
  currentChatId, 
  setCurrentChatId, 
  startNewChat, 
  deleteChat, 
  mobileMenuOpen, 
  setMobileMenuOpen 
}) => {
  const handleChatSelect = (chatId) => {
    setCurrentChatId(chatId)
    setMobileMenuOpen(false) // Close mobile menu when chat is selected
  }

  return (
    <>
      {/* Mobile Sidebar Overlay - only show on mobile when menu is open */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container - responsive behavior */}
      <aside className={`
  ${mobileMenuOpen ? 'fixed top-16 left-0 bottom-0 z-50 w-80' : 'hidden'} 
  lg:block lg:static lg:w-80 lg:h-screen
  border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 
  p-5 flex flex-col gap-5 transition-all duration-300
`}>
        {/* New Chat Button */}
        <button 
          className="w-full my-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 border-none py-4 px-5 rounded-xl font-semibold cursor-pointer shadow-lg hover:shadow-glow hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2"
          onClick={() => {
            startNewChat()
            setMobileMenuOpen(false)
          }}
        >
          <span className="text-lg ">✨</span>
          New Chat
        </button>
        
        {/* Chat List */}
        <div className="flex flex-col my-2 gap-3 flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900">
          {chats.length === 0 && (
            <div className="text-gray-500 dark:text-gray-400 text-center p-4 italic animate-pulse">
              No chats yet
            </div>
          )}
          
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={`group flex items-center justify-between py-4 px-4 rounded-xl cursor-pointer border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
                currentChatId === chat.id 
                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-900 dark:border-white shadow-glow' 
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onClick={() => handleChatSelect(chat.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {chat.title || 'New Chat'}
                </div>
                {chat.filename && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                    📄 {chat.filename}
                  </div>
                )}
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {new Date(chat.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <button 
                className="ml-2 p-2 rounded-full bg-transparent hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all duration-200 opacity-0 group-hover:opacity-100"
                onClick={(e) => { 
                  e.stopPropagation() 
                  deleteChat(chat.id)
                }}
                title="Delete chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 bg-white dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
            <p>Excel Chat AI v1.0</p>
            <p>Forbes Marshall</p>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar