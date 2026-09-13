import React, { useReducer, useEffect } from 'react';
import ApiKeyModal from './components/ApiKeyModal';
import FileDropZone from './components/FileDropZone';
import FileList from './components/FileList';
import ClusterView from './components/ClusterView';
import Header from './components/Header';
import ProgressModal from './components/ProgressModal';

const initialState = {
  apiKeySet: false,
  showApiModal: true,
  files: [],
  clusters: [],
  isProcessing: false,
  processingStep: '',
  numClusters: 3,
  outputFolder: '',
  organized: false,
  error: '',
  orgMode: 'copy',
  injectTags: false,
  writeManifest: false,
  writeClusterIndex: false,
  injectClusterDescription: false,
  preserveRelativePaths: false,
  isGlobalDragging: false,
  aiHint: '',
  dedupFolder: '',        // output folder used for dedup check
  dedupSkipped: 0,        // how many files were hidden as already-organised
  namespace: '',          // Pinecone namespace
  embeddingModel: 'text-embedding-3-small',
  embeddings: [],         // Raw embeddings for similarity checks
  chatProvider: 'openai',
  embeddingProvider: 'openai',
  providerOptions: { chat: ['openai'], embedding: ['openai'] },
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_API_KEY_STATUS':
      return { ...state, apiKeySet: action.payload };
    case 'SHOW_API_MODAL':
      return { ...state, showApiModal: action.payload };
    case 'SET_FILES':
      return { ...state, files: action.payload, clusters: [], organized: false };
    case 'ADD_FILES': {
      const existingPaths = new Set(state.files.map(f => f.path));
      const newFiles = action.payload.filter(f => !existingPaths.has(f.path));
      return { ...state, files: [...state.files, ...newFiles], clusters: [], organized: false };
    }
    case 'REMOVE_FILE':
      return { ...state, files: state.files.filter((_, i) => i !== action.payload), clusters: [], organized: false };
    case 'CLEAR_FILES':
      return { ...state, files: [], clusters: [], organized: false };
    case 'SET_CLUSTERS':
      return { ...state, clusters: action.payload.clusters, embeddings: action.payload.embeddings || state.embeddings };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'SET_PROCESSING_STEP':
      return { ...state, processingStep: action.payload };
    case 'SET_NUM_CLUSTERS':
      return { ...state, numClusters: action.payload };
    case 'SET_OUTPUT_FOLDER':
      return { ...state, outputFolder: action.payload };
    case 'SET_ORGANIZED':
      return { ...state, organized: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_ORG_MODE':
      return { ...state, orgMode: action.payload };
    case 'SET_INJECT_TAGS':
      return { ...state, injectTags: action.payload };
    case 'SET_WRITE_MANIFEST':
      return { ...state, writeManifest: action.payload };
    case 'SET_WRITE_CLUSTER_INDEX':
      return { ...state, writeClusterIndex: action.payload };
    case 'SET_INJECT_CLUSTER_DESCRIPTION':
      return { ...state, injectClusterDescription: action.payload };
    case 'SET_PRESERVE_RELATIVE_PATHS':
      return { ...state, preserveRelativePaths: action.payload };
    case 'SET_GLOBAL_DRAGGING':
      return { ...state, isGlobalDragging: action.payload };
    case 'SET_AI_HINT':
      return { ...state, aiHint: action.payload };
    case 'SET_DEDUP_FOLDER':
      return { ...state, dedupFolder: action.payload };
    case 'SET_DEDUP_SKIPPED':
      return { ...state, dedupSkipped: action.payload };
    case 'APPLY_DEDUP': {
      // Filter files that are already organised (same path AND same mtime)
      const { entries, folderPath } = action.payload;
      const filtered = [];
      let skipped = 0;
      for (const f of state.files) {
        const recordedMtime = entries[f.path];
        if (recordedMtime) {
          const fileMtime = f.modified ? new Date(f.modified).toISOString() : null;
          // Skip if mtime matches (file unchanged since last organise)
          if (fileMtime && fileMtime === recordedMtime) {
            skipped++;
            continue;
          }
        }
        filtered.push(f);
      }
      return { ...state, files: filtered, dedupFolder: folderPath, dedupSkipped: skipped, clusters: [], organized: false };
    }
    case 'MOVE_FILE': {
      const { fileIndex, fromClusterIndex, toClusterIndex } = action.payload;
      const newClusters = state.clusters.map(c => ({
        ...c,
        fileIndices: [...c.fileIndices]
      }));
      const fromCluster = newClusters[fromClusterIndex];
      const idx = fromCluster.fileIndices.indexOf(fileIndex);
      if (idx > -1) fromCluster.fileIndices.splice(idx, 1);
      if (!newClusters[toClusterIndex].fileIndices.includes(fileIndex)) {
        newClusters[toClusterIndex].fileIndices.push(fileIndex);
      }
      return { ...state, clusters: newClusters, organized: false };
    }
    case 'RENAME_CLUSTER':
      return {
        ...state,
        clusters: state.clusters.map((c, i) =>
          i === action.payload.index ? { ...c, name: action.payload.name } : c
        ),
        organized: false,
      };
    case 'MERGE_CLUSTERS': {
      const { fromIndex, toIndex } = action.payload;
      const fromCluster = state.clusters[fromIndex];
      const toCluster = state.clusters[toIndex];
      if (!fromCluster || !toCluster || fromIndex === toIndex) return state;
      const merged = {
        ...toCluster,
        fileIndices: [...toCluster.fileIndices, ...fromCluster.fileIndices]
      };
      const newClusters = state.clusters
        .filter((_, i) => i !== fromIndex)
        .map((c, i) => {
          const origTo = fromIndex < toIndex ? toIndex - 1 : toIndex;
          return i === origTo ? merged : state.clusters[i < fromIndex ? i : i + 1];
        });
      return { ...state, clusters: newClusters, organized: false };
    }
    case 'SPLIT_CLUSTER': {
      const { clusterIndex, fileIndices } = action.payload;
      const cluster = state.clusters[clusterIndex];
      if (!cluster || fileIndices.length === 0) return state;
      const remaining = cluster.fileIndices.filter(i => !fileIndices.includes(i));
      const newCluster = { name: 'New cluster', description: '', fileIndices: [...fileIndices] };
      const newClusters = [...state.clusters];
      newClusters[clusterIndex] = { ...cluster, fileIndices: remaining };
      newClusters.splice(clusterIndex + 1, 0, newCluster);
      return { ...state, clusters: newClusters, organized: false };
    }
    case 'SET_NAMESPACE':
      return { ...state, namespace: action.payload };
    case 'SET_CLUSTER_NAMESPACE':
      return {
        ...state,
        clusters: state.clusters.map((c, i) =>
          i === action.payload.index ? { ...c, namespace: action.payload.namespace } : c
        ),
        organized: false,
      };
    case 'SET_EMBEDDING_MODEL':
      return { ...state, embeddingModel: action.payload };
    case 'SET_PROVIDER_CONFIG':
      return {
        ...state,
        chatProvider: action.payload.chatProvider,
        embeddingProvider: action.payload.embeddingProvider,
        providerOptions: { chat: action.payload.chatOptions, embedding: action.payload.embeddingOptions },
      };
    case 'SET_CHAT_PROVIDER':
      return { ...state, chatProvider: action.payload };
    case 'SET_EMBEDDING_PROVIDER':
      return { ...state, embeddingProvider: action.payload };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { apiKeySet, showApiModal, files, clusters, isProcessing, processingStep, numClusters, outputFolder, organized, error, orgMode, injectTags, writeManifest, writeClusterIndex, injectClusterDescription, preserveRelativePaths, isGlobalDragging, aiHint, dedupFolder, dedupSkipped, namespace, embeddingModel, embeddings, chatProvider, embeddingProvider, providerOptions } = state;

  // Update suggested clusters when files change
  useEffect(() => {
    if (files.length > 0 && window.electronAPI) {
      window.electronAPI.suggestClusters(files.length).then((val) => {
        dispatch({ type: 'SET_NUM_CLUSTERS', payload: val });
      });
    }
  }, [files.length]);

  // Check if API key is available via stored key or .env on startup
  useEffect(() => {
    const initApiKey = async () => {
      // Try stored key first
      if (window.electronAPI?.loadApiKey) {
        const result = await window.electronAPI.loadApiKey();
        if (result.success) {
          dispatch({ type: 'SET_API_KEY_STATUS', payload: true });
          dispatch({ type: 'SHOW_API_MODAL', payload: false });
          return;
        }
      }
      // Fallback to env
      if (window.electronAPI?.checkEnvApiKey) {
        const result = await window.electronAPI.checkEnvApiKey();
        if (result.success) {
          dispatch({ type: 'SET_API_KEY_STATUS', payload: true });
          dispatch({ type: 'SHOW_API_MODAL', payload: false });
        }
      }
    };
    initApiKey();
  }, []);

  // Load current provider config (from .env, or a prior in-app switch) on startup
  useEffect(() => {
    if (window.electronAPI?.getProviderConfig) {
      window.electronAPI.getProviderConfig().then((config) => {
        dispatch({ type: 'SET_PROVIDER_CONFIG', payload: config });
      });
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onProgress) {
      const handleProgress = (event, msg) => {
        dispatch({ type: 'SET_PROCESSING_STEP', payload: msg });
      };
      window.electronAPI.onProgress(handleProgress);
      return () => {
        if (window.electronAPI.removeProgressListener) {
          window.electronAPI.removeProgressListener();
        }
      };
    }
  }, []);

  const handleApiKeySubmit = async (apiKey, baseURL, pineconeKey) => {
    try {
      const result = await window.electronAPI.setApiKey(apiKey, baseURL, pineconeKey);
      if (result.success) {
        await window.electronAPI.saveApiKey(apiKey, baseURL, pineconeKey);
        dispatch({ type: 'SET_API_KEY_STATUS', payload: true });
        dispatch({ type: 'SHOW_API_MODAL', payload: false });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error || 'Invalid API key' });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to set API key: ' + err.message });
    }
  };

  const handleChatProviderChange = async (providerName) => {
    const result = await window.electronAPI.setChatProvider(providerName);
    if (result.success) {
      dispatch({ type: 'SET_CHAT_PROVIDER', payload: providerName });
    } else {
      dispatch({ type: 'SET_ERROR', payload: result.error || 'Failed to switch naming provider' });
    }
  };

  const handleEmbeddingProviderChange = async (providerName) => {
    const result = await window.electronAPI.setEmbeddingProvider(providerName);
    if (result.success) {
      dispatch({ type: 'SET_EMBEDDING_PROVIDER', payload: providerName });
    } else {
      dispatch({ type: 'SET_ERROR', payload: result.error || 'Failed to switch embedding provider' });
    }
  };

  const handleSelectFolder = async () => {
    const folderPaths = await window.electronAPI.selectFolder();
    if (folderPaths && folderPaths.length > 0) {
      await handleProcessPaths(folderPaths);
    }
  };

  const handleProcessPaths = async (paths) => {
    if (paths.length > 0) {
      const result = await window.electronAPI.processPaths(paths);
      if (result.success) {
        dispatch({ type: 'ADD_FILES', payload: result.files });
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error });
      }
    }
  };

  const handleSelectFiles = async () => {
    const filePaths = await window.electronAPI.selectFiles();
    if (filePaths && filePaths.length > 0) {
      await handleProcessPaths(filePaths);
    }
  };

  const handleRemoveFile = (index) => {
    dispatch({ type: 'REMOVE_FILE', payload: index });
  };

  const handleClearFiles = () => {
    dispatch({ type: 'CLEAR_FILES' });
  };

  const handleCluster = async () => {
    if (files.length < 2) {
      dispatch({ type: 'SET_ERROR', payload: 'Please add at least 2 files to cluster' });
      return;
    }

    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_PROCESSING_STEP', payload: 'Analyzing file contents with AI...' });
    dispatch({ type: 'SET_ERROR', payload: '' });

    try {
      const result = await window.electronAPI.clusterFiles(files, numClusters, aiHint);
      if (result.success) {
        dispatch({ type: 'SET_CLUSTERS', payload: { clusters: result.clusters, embeddings: result.embeddings } });
        dispatch({ type: 'SET_PROCESSING_STEP', payload: '' });
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Clustering failed: ' + err.message });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  };

  const handleSuggestK = async () => {
    if (files.length < 4) {
      dispatch({ type: 'SET_ERROR', payload: 'Add at least 4 files to suggest k' });
      return;
    }
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_PROCESSING_STEP', payload: 'Analyzing structure to suggest cluster count...' });
    dispatch({ type: 'SET_ERROR', payload: '' });
    try {
      const result = await window.electronAPI.suggestK(files);
      const k = result.suggestedK != null ? result.suggestedK : numClusters;
      dispatch({ type: 'SET_NUM_CLUSTERS', payload: Math.max(2, Math.min(15, k)) });
      if (result.success) {
        dispatch({ type: 'SET_ERROR', payload: '' });
      } else if (result.error) {
        dispatch({ type: 'SET_ERROR', payload: 'Suggest k failed, using fallback: ' + result.error });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Suggest k failed: ' + err.message });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  };

  const handleGlobalDragOver = (e) => {
    e.preventDefault();
    if (!isGlobalDragging && files.length > 0) {
      dispatch({ type: 'SET_GLOBAL_DRAGGING', payload: true });
    }
  };

  const handleGlobalDrop = (e) => {
    e.preventDefault();
    dispatch({ type: 'SET_GLOBAL_DRAGGING', payload: false });
    if (e.dataTransfer && e.dataTransfer.files) {
      const paths = Array.from(e.dataTransfer.files).map(f => f.path).filter(Boolean);
      if (paths.length > 0) {
        handleProcessPaths(paths);
      }
    }
  };

  const handleSelectOutputFolder = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      dispatch({ type: 'SET_OUTPUT_FOLDER', payload: Array.isArray(folderPath) ? folderPath[0] : folderPath });
    }
  };

  const handleCheckDuplicates = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    const resolved = Array.isArray(folderPath) ? folderPath[0] : folderPath;
    if (!resolved) return;
    const result = await window.electronAPI.readDedupManifest(resolved);
    if (result.success) {
      dispatch({ type: 'APPLY_DEDUP', payload: { entries: result.entries, folderPath: resolved } });
      // Also pre-fill the output folder if not already set
      if (!outputFolder) {
        dispatch({ type: 'SET_OUTPUT_FOLDER', payload: resolved });
      }
    } else {
      dispatch({ type: 'SET_ERROR', payload: 'Could not read existing folder: ' + result.error });
    }
  };

  const handleOrganize = async () => {
    if (!outputFolder) {
      dispatch({ type: 'SET_ERROR', payload: 'Please select an output folder first' });
      return;
    }

    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_PROCESSING_STEP', payload: 'Organizing files into folders...' });
    dispatch({ type: 'SET_ERROR', payload: '' });

    try {
      const result = await window.electronAPI.organizeFiles(outputFolder, clusters, files, { 
        mode: orgMode, 
        injectTags, 
        writeManifest, 
        writeClusterIndex, 
        injectClusterDescription, 
        preserveRelativePaths,
        namespace 
      });
      if (result.success) {
        dispatch({ type: 'SET_ORGANIZED', payload: true });
        dispatch({ type: 'SET_PROCESSING_STEP', payload: '' });
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: 'Organization failed: ' + err.message });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  };

  const handleMoveFile = (fileIndex, fromClusterIndex, toClusterIndex) => {
    dispatch({ type: 'MOVE_FILE', payload: { fileIndex, fromClusterIndex, toClusterIndex } });
  };

  const handleRenameCluster = (clusterIndex, newName) => {
    dispatch({ type: 'RENAME_CLUSTER', payload: { index: clusterIndex, name: newName } });
  };

  const handleMergeClusters = (fromIndex, toIndex) => {
    dispatch({ type: 'MERGE_CLUSTERS', payload: { fromIndex, toIndex } });
  };

  const handleSplitCluster = (clusterIndex, fileIndices) => {
    dispatch({ type: 'SPLIT_CLUSTER', payload: { clusterIndex, fileIndices } });
  };

  return (
    <div
      className="h-screen flex flex-col bg-dark-200 relative"
      onDragOver={handleGlobalDragOver}
    >
      {isGlobalDragging && (
        <div
          className="absolute inset-0 z-50 bg-primary-500/20 border-4 border-primary-500 border-dashed m-2 rounded-xl flex items-center justify-center backdrop-blur-sm transition-all"
          onDragLeave={() => dispatch({ type: 'SET_GLOBAL_DRAGGING', payload: false })}
          onDrop={handleGlobalDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="bg-dark-100 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-primary-500/30">
            <span className="text-6xl">📥</span>
            <h2 className="text-2xl font-bold text-white">Drop markdown files and folders</h2>
            <p className="text-gray-400">Add directly to your current session</p>
          </div>
        </div>
      )}

      <Header
        apiKeySet={apiKeySet}
        onApiKeyClick={() => dispatch({ type: 'SHOW_API_MODAL', payload: true })}
        fileCount={files.length}
        chatProvider={chatProvider}
        embeddingProvider={embeddingProvider}
        providerOptions={providerOptions}
        onChatProviderChange={handleChatProviderChange}
        onEmbeddingProviderChange={handleEmbeddingProviderChange}
      />

      <main className="flex-1 overflow-hidden p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300">
            {error}
            <button
              onClick={() => dispatch({ type: 'SET_ERROR', payload: '' })}
              className="ml-4 text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {files.length === 0 ? (
          <FileDropZone
            onSelectFolder={handleSelectFolder}
            onSelectFiles={handleSelectFiles}
            onDropPaths={handleProcessPaths}
          />
        ) : clusters.length === 0 ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectFolder}
                  className="px-4 py-2 bg-dark-100 hover:bg-dark-300 rounded-lg transition-colors border border-gray-600"
                >
                  + Add Folder
                </button>
                <button
                  onClick={handleSelectFiles}
                  className="px-4 py-2 bg-dark-100 hover:bg-dark-300 rounded-lg transition-colors border border-gray-600"
                >
                  + Add Files
                </button>
                <button
                  onClick={handleClearFiles}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
                <div className="w-px h-6 bg-gray-600"></div>
                <button
                  onClick={handleCheckDuplicates}
                  title="Select your existing organised folder to filter out files that have already been organised there"
                  className="px-4 py-2 bg-dark-100 hover:bg-dark-300 rounded-lg transition-colors border border-amber-600/50 text-amber-400 hover:text-amber-300 text-sm"
                >
                  Filter Already Organised
                </button>
                {dedupSkipped > 0 && (
                  <span className="px-2 py-1 bg-amber-900/40 border border-amber-600/40 rounded text-amber-400 text-xs" title={`${dedupSkipped} file(s) removed — already in ${dedupFolder}`}>
                    {dedupSkipped} skipped
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-gray-300">
                  <span>Clusters:</span>
                  <input
                    type="number"
                    min="2"
                    max="15"
                    value={numClusters}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        dispatch({ type: 'SET_NUM_CLUSTERS', payload: Math.max(2, Math.min(15, val)) });
                      }
                    }}
                    className="w-16 px-2 py-1 bg-dark-100 border border-gray-600 rounded text-center"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSuggestK}
                  disabled={!apiKeySet || files.length < 4}
                  className="px-3 py-1 text-sm bg-dark-100 hover:bg-dark-300 border border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Use elbow method to suggest number of clusters"
                >
                  Suggest k
                </button>
                <input
                  type="text"
                  placeholder="Optional: AI naming hint (e.g. 'Focus on Claude')"
                  value={aiHint}
                  onChange={(e) => dispatch({ type: 'SET_AI_HINT', payload: e.target.value })}
                  className="w-64 px-3 py-1 bg-dark-100 border border-gray-600 rounded text-white text-sm"
                />
                <button
                  onClick={handleCluster}
                  disabled={!apiKeySet || files.length < 2}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  🤖 Cluster with AI
                </button>
              </div>
            </div>

            <FileList
              files={files}
              onRemove={handleRemoveFile}
            />
          </div>
        ) : (
          <ClusterView
            clusters={clusters}
            files={files}
            embeddings={embeddings}
            numClustersRequested={numClusters}
            outputFolder={outputFolder}
            organized={organized}
            orgMode={orgMode}
            setOrgMode={(val) => dispatch({ type: 'SET_ORG_MODE', payload: val })}
            injectTags={injectTags}
            setInjectTags={(val) => dispatch({ type: 'SET_INJECT_TAGS', payload: val })}
            writeManifest={writeManifest}
            setWriteManifest={(val) => dispatch({ type: 'SET_WRITE_MANIFEST', payload: val })}
            writeClusterIndex={writeClusterIndex}
            setWriteClusterIndex={(val) => dispatch({ type: 'SET_WRITE_CLUSTER_INDEX', payload: val })}
            injectClusterDescription={injectClusterDescription}
            setInjectClusterDescription={(val) => dispatch({ type: 'SET_INJECT_CLUSTER_DESCRIPTION', payload: val })}
            preserveRelativePaths={preserveRelativePaths}
            setPreserveRelativePaths={(val) => dispatch({ type: 'SET_PRESERVE_RELATIVE_PATHS', payload: val })}
            namespace={namespace}
            setNamespace={(val) => dispatch({ type: 'SET_NAMESPACE', payload: val })}
            embeddingModel={embeddingModel}
            setEmbeddingModel={async (val) => {
              await window.electronAPI.setEmbeddingModel(val);
              dispatch({ type: 'SET_EMBEDDING_MODEL', payload: val });
            }}
            onSelectOutputFolder={handleSelectOutputFolder}
            onOrganize={handleOrganize}
            onMoveFile={handleMoveFile}
            onRenameCluster={handleRenameCluster}
            onSetClusterNamespace={(index, ns) => dispatch({ type: 'SET_CLUSTER_NAMESPACE', payload: { index, namespace: ns } })}
            onMergeClusters={handleMergeClusters}
            onSplitCluster={handleSplitCluster}
            onRecluster={() => dispatch({ type: 'SET_CLUSTERS', payload: [] })}
          />
        )}
      </main>

      {showApiModal && (
        <ApiKeyModal
          onSubmit={handleApiKeySubmit}
          onClose={() => apiKeySet && dispatch({ type: 'SHOW_API_MODAL', payload: false })}
          error={error}
          isSet={apiKeySet}
        />
      )}

      {isProcessing && (
        <ProgressModal step={processingStep} />
      )}
    </div>
  );
}

export default App;
