import React, { useState } from 'react';

function ApiKeyModal({ onSubmit, onClose, error, isSet }) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    
    setLoading(true);
    await onSubmit(apiKey.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-dark-100 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔑
          </div>
          <h2 className="text-2xl font-bold text-white">OpenAI API Key</h2>
          <p className="text-gray-400 mt-2">
            Enter your OpenAI API key to enable AI-powered clustering
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-3 bg-dark-200 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {isSet && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-dark-200 hover:bg-dark-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!apiKey.trim() || loading}
              className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {loading ? 'Validating...' : isSet ? 'Update Key' : 'Connect'}
            </button>
          </div>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Your API key is stored locally and never sent to any server except OpenAI.
        </p>
      </div>
    </div>
  );
}

export default ApiKeyModal;
