import React, { useState, useEffect } from 'react';
import ApiKeyModal from './components/ApiKeyModal';
import FileDropZone from './components/FileDropZone';
import FileList from './components/FileList';
import ClusterView from './components/ClusterView';
import Header from './components/Header';
import ProgressModal from './components/ProgressModal';

function App() {
  const [apiKeySet, setApiKeySet] = useState(false);
  const [showApiModal, setShowApiModal] = useState(true);
  const [files, setFiles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [numClusters, setNumClusters] = useState(3);
  const [outputFolder, setOutputFolder] = useState('');
  const [organized, setOrganized] = useState(false);
  const [error, setError] = useState('');
  const [orgMode, setOrgMode] = useState('copy');
  const [injectTags, setInjectTags] = useState(false);

  // Update suggested clusters when files change
  useEffect(() => {
    if (files.length > 0 && window.electronAPI) {
      window.electronAPI.suggestClusters(files.length).then(setNumClusters);
    }
  }, [files.length]);

  // Check if API key is available via .env on startup
  useEffect(() => {
    const checkEnv = async () => {
      if (window.electronAPI && window.electronAPI.checkEnvApiKey) {
        const result = await window.electronAPI.checkEnvApiKey();
        if (result.success) {
          setApiKeySet(true);
          setShowApiModal(false);
        } else {
          // If not in env, we could check localStorage, but assuming modal is the fallback
        }
      }
    };
    checkEnv();
  }, []);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onProgress) {
      const handleProgress = (event, msg) => {
        setProcessingStep(msg);
      };
      window.electronAPI.onProgress(handleProgress);
      return () => {
        if (window.electronAPI.removeProgressListener) {
          window.electronAPI.removeProgressListener();
        }
      };
    }
  }, []);

  const handleApiKeySubmit = async (apiKey, baseURL) => {
    try {
      const result = await window.electronAPI.setApiKey(apiKey, baseURL);
      if (result.success) {
        setApiKeySet(true);
        setShowApiModal(false);
        setError('');
      } else {
        setError(result.error || 'Invalid API key');
      }
    } catch (err) {
      setError('Failed to set API key: ' + err.message);
    }
  };

  const handleSelectFolder = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      const result = await window.electronAPI.readFolder(folderPath);
      if (result.success) {
        setFiles(result.files);
        setClusters([]);
        setOrganized(false);
      } else {
        setError(result.error);
      }
    }
  };

  const handleSelectFiles = async () => {
    const filePaths = await window.electronAPI.selectFiles();
    if (filePaths.length > 0) {
      const result = await window.electronAPI.readFiles(filePaths);
      if (result.success) {
        setFiles(prev => {
          const existingPaths = new Set(prev.map(f => f.path));
          const newFiles = result.files.filter(f => !existingPaths.has(f.path));
          return [...prev, ...newFiles];
        });
        setClusters([]);
        setOrganized(false);
      } else {
        setError(result.error);
      }
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setClusters([]);
    setOrganized(false);
  };

  const handleClearFiles = () => {
    setFiles([]);
    setClusters([]);
    setOrganized(false);
  };

  const handleCluster = async () => {
    if (files.length < 2) {
      setError('Please add at least 2 files to cluster');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Analyzing file contents with AI...');
    setError('');

    try {
      const result = await window.electronAPI.clusterFiles(files, numClusters);
      if (result.success) {
        setClusters(result.clusters);
        setProcessingStep('');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Clustering failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectOutputFolder = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      setOutputFolder(folderPath);
    }
  };

  const handleOrganize = async () => {
    if (!outputFolder) {
      setError('Please select an output folder first');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Organizing files into folders...');
    setError('');

    try {
      const result = await window.electronAPI.organizeFiles(outputFolder, clusters, files, { mode: orgMode, injectTags });
      if (result.success) {
        setOrganized(true);
        setProcessingStep('');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Organization failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoveFile = (fileIndex, fromClusterIndex, toClusterIndex) => {
    setClusters(prev => {
      const newClusters = prev.map(c => ({
        ...c,
        fileIndices: [...c.fileIndices]
      }));
      
      // Remove from source cluster
      const fromCluster = newClusters[fromClusterIndex];
      const indexInCluster = fromCluster.fileIndices.indexOf(fileIndex);
      if (indexInCluster > -1) {
        fromCluster.fileIndices.splice(indexInCluster, 1);
      }
      
      // Add to target cluster
      if (!newClusters[toClusterIndex].fileIndices.includes(fileIndex)) {
        newClusters[toClusterIndex].fileIndices.push(fileIndex);
      }
      
      return newClusters;
    });
    setOrganized(false);
  };

  const handleRenameCluster = (clusterIndex, newName) => {
    setClusters(prev => prev.map((c, i) => 
      i === clusterIndex ? { ...c, name: newName } : c
    ));
    setOrganized(false);
  };

  return (
    <div className="h-screen flex flex-col bg-dark-200">
      <Header 
        apiKeySet={apiKeySet} 
        onApiKeyClick={() => setShowApiModal(true)}
        fileCount={files.length}
      />
      
      <main className="flex-1 overflow-hidden p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300">
            {error}
            <button 
              onClick={() => setError('')}
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
          />
        ) : clusters.length === 0 ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectFiles}
                  className="px-4 py-2 bg-dark-100 hover:bg-dark-300 rounded-lg transition-colors"
                >
                  + Add More Files
                </button>
                <button
                  onClick={handleClearFiles}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-gray-300">
                  <span>Clusters:</span>
                  <input
                    type="number"
                    min="2"
                    max="15"
                    value={numClusters}
                    onChange={(e) => setNumClusters(parseInt(e.target.value) || 3)}
                    className="w-16 px-2 py-1 bg-dark-100 border border-gray-600 rounded text-center"
                  />
                </label>
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
            outputFolder={outputFolder}
            organized={organized}
            orgMode={orgMode}
            setOrgMode={setOrgMode}
            injectTags={injectTags}
            setInjectTags={setInjectTags}
            onSelectOutputFolder={handleSelectOutputFolder}
            onOrganize={handleOrganize}
            onMoveFile={handleMoveFile}
            onRenameCluster={handleRenameCluster}
            onRecluster={() => setClusters([])}
          />
        )}
      </main>

      {showApiModal && (
        <ApiKeyModal
          onSubmit={handleApiKeySubmit}
          onClose={() => apiKeySet && setShowApiModal(false)}
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
