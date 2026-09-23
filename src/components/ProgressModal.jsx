import React from 'react';

function ProgressModal({ step, onCancel, cancelling }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-dark-100 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-gray-700 text-center">
        <div className="w-16 h-16 mx-auto mb-6 relative">
          <div className="absolute inset-0 border-4 border-primary-500/30 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-primary-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-2xl">
            🤖
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">Processing</h3>
        <p className="text-gray-400">{step || 'Please wait...'}</p>
        
        {onCancel && <button onClick={onCancel} disabled={cancelling} className="mt-5 px-4 py-2 rounded-lg bg-dark-300 border border-gray-600 disabled:opacity-50">{cancelling ? 'Cancelling…' : 'Cancel task'}</button>}
        <div className="mt-6 h-2 bg-dark-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-500 to-primary-700 shimmer"></div>
        </div>
      </div>
    </div>
  );
}

export default ProgressModal;
