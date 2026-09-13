import React, { useState } from 'react';

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  gemini: 'Gemini',
  local: 'Local (Ollama)',
};

function Header({
  apiKeySet,
  onApiKeyClick,
  fileCount,
  chatProvider,
  embeddingProvider,
  providerOptions,
  onChatProviderChange,
  onEmbeddingProviderChange,
}) {
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
      const logWindow = window.open('', 'Logs', 'width=800,height=600');
      // Escape HTML entities to prevent XSS
      const escaped = logs
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
            <pre>${escaped
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

        {providerOptions && (
          <div className="flex items-center gap-2 bg-dark-200 px-2 py-1.5 rounded-lg border border-gray-700 text-xs">
            <label className="flex items-center gap-1" title="Backend used to name clusters">
              <span className="text-gray-500">Naming:</span>
              <select
                value={chatProvider}
                onChange={(e) => onChatProviderChange(e.target.value)}
                className="bg-dark-100 border border-gray-600 rounded px-1 py-0.5 text-gray-300"
                aria-label="Cluster naming provider"
              >
                {providerOptions.chat.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>
                ))}
              </select>
            </label>
            <div className="w-px h-4 bg-gray-600"></div>
            <label className="flex items-center gap-1" title="Backend used for embeddings — this drives the actual clustering">
              <span className="text-gray-500">Embeddings:</span>
              <select
                value={embeddingProvider}
                onChange={(e) => onEmbeddingProviderChange(e.target.value)}
                className="bg-dark-100 border border-gray-600 rounded px-1 py-0.5 text-gray-300"
                aria-label="Embedding provider"
              >
                {providerOptions.embedding.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <button
          onClick={onApiKeyClick}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            apiKeySet
              ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
              : 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50'
          }`}
          aria-label={apiKeySet ? 'API connected. Click to manage.' : 'API key not set. Click to configure.'}
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
            aria-label="Debug options"
            aria-haspopup="true"
            aria-expanded={showDebugMenu}
          >
            ⚙️
          </button>
          
          {showDebugMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowDebugMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-48 bg-dark-100 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden" role="menu">
                <button
                  onClick={handleViewLogs}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:bg-dark-300 transition-colors flex items-center gap-2"
                  role="menuitem"
                >
                  📋 View Logs
                </button>
                <button
                  onClick={handleOpenLogs}
                  className="w-full px-4 py-3 text-left text-gray-300 hover:bg-dark-300 transition-colors flex items-center gap-2"
                  role="menuitem"
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
