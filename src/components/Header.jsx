import React, { useState } from 'react';

function Header({ apiKeySet, onApiKeyClick, fileCount }) {
  const [showDebugMenu, setShowDebugMenu] = useState(false);

  const handleOpenLogs = async () => {
    if (window.electronAPI) {
      await window.electronAPI.openLogFolder();
    }
    setShowDebugMenu(false);
  };

  const handleViewLogs = async () => {
    if (window.electronAPI) {
      const logs = await window.electronAPI.getLogs(200);
      // Open logs in a new window
      const logWindow = window.open('', 'Logs', 'width=800,height=600');
      logWindow.document.write(`
        <html>
          <head>
            <title>Markdown Clusterer - Logs</title>
            <style>
              body { 
                background: #1a1a2e; 
                color: #e0e0e0; 
                font-family: monospace; 
                padding: 20px;
                margin: 0;
              }
              pre { 
                white-space: pre-wrap; 
                word-wrap: break-word;
                font-size: 12px;
                line-height: 1.5;
              }
              h1 { 
                color: #0ea5e9; 
                font-size: 18px;
                margin-bottom: 20px;
              }
              .error { color: #ef4444; }
              .warn { color: #f59e0b; }
              .info { color: #22c55e; }
            </style>
          </head>
          <body>
            <h1>Application Logs</h1>
            <pre>${logs
              .replace(/\[ERROR\]/g, '<span class="error">[ERROR]</span>')
              .replace(/\[WARN\]/g, '<span class="warn">[WARN]</span>')
              .replace(/\[INFO\]/g, '<span class="info">[INFO]</span>')
            }</pre>
          </body>
        </html>
      `);
    }
    setShowDebugMenu(false);
  };

  return (
    <header className="bg-dark-100 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center text-xl">
          📁
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Markdown Clusterer</h1>
          <p className="text-sm text-gray-400">AI-powered transcript organization</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {fileCount > 0 && (
          <span className="text-gray-400">
            {fileCount} file{fileCount !== 1 ? 's' : ''} loaded
          </span>
        )}
        
        <button
          onClick={onApiKeyClick}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            apiKeySet 
              ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' 
              : 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${apiKeySet ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
          {apiKeySet ? 'API Connected' : 'Set API Key'}
        </button>

        {/* Debug Menu */}
        <div className="relative">
          <button
            onClick={() => setShowDebugMenu(!showDebugMenu)}
            className="px-3 py-2 text-gray-400 hover:text-white hover:bg-dark-300 rounded-lg transition-colors"
            title="Debug Options"
          >
            ⚙️
          </button>
          
          {showDebugMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowDebugMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-48 bg-dark-100 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
                <button
                  onClick={handleViewLogs}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:bg-dark-300 transition-colors flex items-center gap-2"
                >
                  📋 View Logs
                </button>
                <button
                  onClick={handleOpenLogs}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:bg-dark-300 transition-colors flex items-center gap-2"
                >
                  📂 Open Log Folder
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
