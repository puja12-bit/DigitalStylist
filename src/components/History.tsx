import React from 'react';
import { HistoryEntry } from '../types';

interface Props {
  history: HistoryEntry[];
  onBack: () => void;
  onClear: () => void;
}

const History: React.FC<Props> = ({ history, onBack, onClear }) => {
  
  // Helper to group history items
  const groupHistory = (entries: HistoryEntry[]) => {
    const groups: { [key: string]: HistoryEntry[] } = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    entries.forEach(entry => {
        const date = new Date(entry.timestamp).toDateString();
        let label = date;
        if (date === today) label = "Today";
        else if (date === yesterday) label = "Yesterday";
        
        if (!groups[label]) groups[label] = [];
        groups[label].push(entry);
    });
    
    // Sort groups so Today comes first, then Yesterday, then older dates descending
    return Object.entries(groups).sort((a, b) => {
        if (a[0] === 'Today') return -1;
        if (b[0] === 'Today') return 1;
        if (a[0] === 'Yesterday') return -1;
        if (b[0] === 'Yesterday') return 1;
        return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    });
  };

  const groupedHistory = groupHistory(history);

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8 sticky top-0 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur py-4 z-10 border-b border-neutral-100 dark:border-neutral-800 transition-colors duration-300">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Dashboard
        </button>
        <div className="flex items-center gap-4">
             <h2 className="text-2xl sm:text-3xl font-serif text-neutral-900 dark:text-white">Your Lookbook</h2>
             {history.length > 0 && (
                 <button 
                    onClick={() => {
                        if(window.confirm("Are you sure you want to clear your style history?")) {
                            onClear();
                        }
                    }}
                    className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 underline"
                 >
                    Clear History
                 </button>
             )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm transition-colors duration-300">
          <div className="inline-block p-4 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <h3 className="text-xl font-medium text-neutral-900 dark:text-white">No History Yet</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2">Generated outfits will appear here for 30 days.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedHistory.map(([label, groupEntries]) => (
            <div key={label}>
                <h3 className="text-lg font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-4 border-l-4 border-primary-200 dark:border-primary-800 pl-3">{label}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {groupEntries.map((entry) => (
                    <div key={entry.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                    <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden">
                        {entry.generatedImageRealUrl ? (
                             <img src={entry.generatedImageRealUrl} alt="Real Outfit Visual" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : entry.generatedImageUrl ? (
                            <img src={entry.generatedImageUrl} alt="Sketch Outfit Visual" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-800">
                                <span className="text-sm">No Visual Generated</span>
                            </div>
                        )}
                        <div className="absolute top-3 right-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-sm">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {entry.generatedImageRealUrl && (
                             <div className="absolute bottom-3 left-3 bg-primary-600/90 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">
                                REAL
                             </div>
                        )}
                    </div>
                    <div className="p-5">
                        <h3 className="font-serif text-xl text-neutral-900 dark:text-white font-bold mb-1 truncate">{entry.occasion}</h3>
                        <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mb-4">{entry.recommendation.overallVibe}</p>
                        
                        <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                        <div className="flex items-start gap-2">
                            <span className="font-semibold min-w-[60px] text-neutral-400 dark:text-neutral-500">Top:</span>
                            <span className="truncate">{entry.recommendation.top.color} {entry.recommendation.top.name}</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="font-semibold min-w-[60px] text-neutral-400 dark:text-neutral-500">Bottom:</span>
                            <span className="truncate">{entry.recommendation.bottom.color} {entry.recommendation.bottom.name}</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="font-semibold min-w-[60px] text-neutral-400 dark:text-neutral-500">Shoes:</span>
                            <span className="truncate">{entry.recommendation.shoes.name}</span>
                        </div>
                        </div>
                    </div>
                    </div>
                ))}
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;