import React, { useState, useCallback, memo } from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

const FileCard = memo(function FileCard({ file, index, onRemove, isExpanded, onToggle }) {
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDisplayDate = (file) => {
    if (file.createdAt) return { date: file.createdAt, label: 'Created' };
    if (file.updatedAt) return { date: file.updatedAt, label: 'Updated' };
    if (file.modified) return { date: file.modified, label: 'Modified' };
    return null;
  };

  const getPreview = (content, maxLength = 200) => {
    const cleaned = content.replace(/^#.*$/gm, '').trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength) + '...';
  };

  return (
    <div
      className="file-card h-full bg-dark-100 rounded-xl p-4 border border-gray-700 hover:border-gray-600 cursor-pointer flex flex-col"
      onClick={() => onToggle(index)}
      role="button"
      tabIndex={0}
      aria-label={`File: ${file.name}, ${formatFileSize(file.size)}. Click to ${isExpanded ? 'collapse' : 'expand'} preview.`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(index); } }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
            📝
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-white truncate" title={file.name}>
              {file.name}
            </h3>
            <p className="text-sm text-gray-500">
              {formatFileSize(file.size)}
            </p>
            {(() => {
              const dateInfo = getDisplayDate(file);
              return dateInfo ? (
                <p className="text-xs text-gray-600" title={`${dateInfo.label}: ${formatDate(dateInfo.date)}`}>
                  📅 {formatDate(dateInfo.date)}
                </p>
              ) : null;
            })()}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="text-gray-500 hover:text-red-400 transition-colors p-1"
          aria-label={`Remove ${file.name}`}
        >
          ✕
        </button>
      </div>

      <div className={`text-sm text-gray-400 flex-1 overflow-hidden ${isExpanded ? '' : 'line-clamp-4'}`}>
        {isExpanded ? (
          <pre className="whitespace-pre-wrap font-sans h-full overflow-auto bg-dark-200 p-3 rounded-lg">
            {file.content.substring(0, 2000)}
            {file.content.length > 2000 && '...'}
          </pre>
        ) : (
          getPreview(file.content)
        )}
      </div>

      {!isExpanded && (
        <p className="text-xs text-gray-600 mt-2 mt-auto pt-2">Click to expand</p>
      )}
    </div>
  );
});

function FileList({ files, onRemove }) {
  const [expandedFile, setExpandedFile] = useState(null);

  const handleToggle = useCallback((index) => {
    setExpandedFile(prev => {
      const next = prev === index ? null : index;
      return next;
    });
  }, []);

  const getColumnCount = (width) => {
    if (width >= 1024) return 3;
    if (width >= 768) return 2;
    return 1;
  };

  const Row = ({ index, style, files, columnCount }) => {
    const startIndex = index * columnCount;
    const items = [];
    
    for (let i = 0; i < columnCount; i++) {
      const itemIndex = startIndex + i;
      if (itemIndex < files.length) {
        items.push(
          <div key={itemIndex} style={{ width: `${100 / columnCount}%`, padding: '8px' }}>
            <FileCard
              file={files[itemIndex]}
              index={itemIndex}
              onRemove={onRemove}
              isExpanded={expandedFile === itemIndex}
              onToggle={handleToggle}
            />
          </div>
        );
      }
    }

    return (
      <div style={{ ...style, display: 'flex' }}>
        {items}
      </div>
    );
  };

  const getItemSize = (index, columnCount) => {
    const startIndex = index * columnCount;
    for (let i = 0; i < columnCount; i++) {
        if (expandedFile === startIndex + i) {
            return 320; // expanded height
        }
    }
    return 180; // normal height
  };

  return (
    <div className="flex-1 overflow-hidden" role="list" aria-label="Loaded files">
      <AutoSizer renderProp={({ height, width }) => {
          if (!width || !height) return null;
          
          const columnCount = getColumnCount(width);
          const rowCount = Math.ceil(files.length / columnCount);
          
          return (
            <List
              style={{ height, width }}
              rowCount={rowCount}
              rowHeight={(i) => getItemSize(i, columnCount)}
              rowProps={{ files, columnCount }}
              rowComponent={Row}
              overscanCount={2}
            />
          );
        }} />
    </div>
  );
}

export default FileList;
