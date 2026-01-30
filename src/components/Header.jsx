import React from 'react';

function Header({ apiKeySet, onApiKeyClick, fileCount }) {
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
      </div>
    </header>
  );
}

export default Header;
