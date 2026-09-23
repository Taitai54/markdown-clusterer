import React, { useState, useEffect } from 'react';

function ApiKeyModal({ onSubmit, onClose, onLocal, onCloudEnabled, error, isSet }) {
  const [local, setLocal] = useState({ baseURL: 'http://127.0.0.1:11434/v1', embeddingModel: 'bge-m3:latest', chatModel: 'gpt-oss:20b' });
  const [offline, setOffline] = useState(false);
  const [localError, setLocalError] = useState('');
  useEffect(() => { window.electronAPI?.getProviderConfig().then(config => {
    setOffline(config.offlineMode);
    if (config.offlineMode) setLocal(config.localSettings);
  }); }, []);
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [pineconeKey, setPineconeKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    
    setLoading(true);
    await onSubmit(apiKey.trim(), baseURL.trim(), pineconeKey.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-dark-100 rounded-2xl p-8 max-w-md w-full mx-4 max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔑
          </div>
          <h2 className="text-2xl font-bold text-white">Model settings</h2>
          <p className="text-gray-400 mt-2">
            Use downloaded local models offline, or configure cloud access.
          </p>
        </div>

        <div className="mb-5 space-y-2">
          <p className="text-sm text-gray-300">Local models — no API key needed</p>
          {Object.entries(local).map(([key, value]) => (
            <label key={key} className="block text-xs text-gray-400">
              {{baseURL: 'Local server URL', embeddingModel: 'Embedding model', chatModel: 'Naming model'}[key]}
              <input aria-label={key} value={value} onChange={e => setLocal({...local, [key]: e.target.value})} className="block w-full p-2 bg-dark-200 border border-gray-600 rounded text-white" />
            </label>
          ))}
          <button disabled={loading} type="button" className="w-full p-2 bg-primary-600 rounded disabled:opacity-50" onClick={async () => {
            setLoading(true); setLocalError('');
            try { await onLocal(local); } catch (e) { setLocalError(e.message); } finally { setLoading(false); }
          }}>{loading ? 'Testing local models…' : 'Test and use offline'}</button>
          <p className="text-xs text-gray-400">Uses only the local server. Disable Ollama cloud features in Ollama settings for fully offline operation.</p>
          {offline && <button type="button" className="text-sm underline" onClick={async () => {
            const result = await window.electronAPI.disableOffline();
            if (result.success) { setOffline(false); onCloudEnabled?.(); } else setLocalError(result.error);
          }}>Allow cloud provider selection</button>}
          {localError && <p role="alert" className="text-red-300">{localError}</p>}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="OpenAI API Key (sk-...)"
              className="w-full px-4 py-3 mb-3 bg-dark-200 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              autoFocus
            />
            <input
              type="text"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="Base URL (Optional, e.g., http://localhost:11434/v1 for Ollama)"
              className="w-full px-4 py-3 mb-3 bg-dark-200 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
            />
            <input
              type="password"
              value={pineconeKey}
              onChange={(e) => setPineconeKey(e.target.value)}
              placeholder="Pinecone API Key (Optional, for E5 embeddings)"
              className="w-full px-4 py-3 bg-dark-200 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {(
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
              disabled={offline || !apiKey.trim() || loading}
              className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {loading ? 'Validating...' : isSet ? 'Update Key' : 'Connect'}
            </button>
          </div>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Cloud requests send document previews to the selected provider. A custom Base URL receives the key entered here.
        </p>
      </div>
    </div>
  );
}

export default ApiKeyModal;
