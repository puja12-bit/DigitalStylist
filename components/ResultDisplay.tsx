import React, { useState } from 'react';
import { OutfitRecommendation, RecommendedItem } from '../types';

interface Props {
  result: OutfitRecommendation;
  generatedImage2D: string | null;
  generatedImageReal: string | null;
  isGenerating2D: boolean;
  onReset: () => void;
  onGenerateReal: () => void;
}

const ItemCard: React.FC<{ item: RecommendedItem; type: string; isShopping?: boolean }> = ({ item, type, isShopping }) => {
  const searchUrl = (site: string) => {
    const query = encodeURIComponent(`${item.color} ${item.name} ${type}`);
    if (site === 'amazon') return `https://www.amazon.com/s?k=${query}`;
    if (site === 'myntra') return `https://www.myntra.com/${query.replace(/%20/g, '-')}`;
    if (site === 'ajio') return `https://www.ajio.com/search/?text=${query}`;
    return '#';
  };

  return (
    <div className={`relative p-5 rounded-2xl border ${isShopping ? 'bg-white dark:bg-neutral-900 border-primary-200 dark:border-primary-800' : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'} shadow-sm flex flex-col h-full`}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{type}</span>
        {isShopping ? (
           <span className="text-[10px] uppercase font-bold px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-md">
             Missing Item
           </span>
        ) : (
           <span className="text-neutral-400">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
           </span>
        )}
      </div>
      
      <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1 leading-snug">{item.color} {item.name}</h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 flex-grow">{item.description}</p>
      
      {/* Reasoning Bubble */}
      <div className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg text-xs text-neutral-600 dark:text-neutral-300 italic mb-4">
         "{item.reasoning}"
      </div>
      
      {isShopping && (
        <div className="mt-auto pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <p className="text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wide">Buy Online</p>
            <div className="grid grid-cols-3 gap-2">
                <a href={searchUrl('amazon')} target="_blank" rel="noreferrer noopener" className="flex flex-col items-center justify-center p-2 rounded bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Amazon
                </a>
                <a href={searchUrl('myntra')} target="_blank" rel="noreferrer noopener" className="flex flex-col items-center justify-center p-2 rounded bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Myntra
                </a>
                <a href={searchUrl('ajio')} target="_blank" rel="noreferrer noopener" className="flex flex-col items-center justify-center p-2 rounded bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Ajio
                </a>
            </div>
        </div>
      )}
    </div>
  );
};

const ResultDisplay: React.FC<Props> = ({ result, generatedImage2D, generatedImageReal, isGenerating2D, onReset, onGenerateReal }) => {
  const [viewMode, setViewMode] = useState<'2D' | 'REAL'>('2D');
  const [isGeneratingReal, setIsGeneratingReal] = useState(false);

  const handleModeChange = (mode: '2D' | 'REAL') => {
    setViewMode(mode);
    if (mode === 'REAL' && !generatedImageReal) {
      setIsGeneratingReal(true);
      setTimeout(() => onGenerateReal(), 100);
    }
  };

  const currentImage = viewMode === '2D' ? generatedImage2D : generatedImageReal;
  const isLoadingReal = viewMode === 'REAL' && !generatedImageReal && isGeneratingReal;
  const isLoading2D = viewMode === '2D' && isGenerating2D;

  // Split items into Shopping vs Wardrobe
  const allItems = [
    { ...result.top, type: 'Top' },
    { ...result.bottom, type: 'Bottom' },
    { ...result.shoes, type: 'Shoes' },
    { ...result.accessory, type: 'Accessory' }
  ];

  const shoppingItems = allItems.filter(i => i.source === 'Shopping');
  const wardrobeItems = allItems.filter(i => i.source === 'Wardrobe');

  return (
    <div className="max-w-7xl mx-auto pb-20 px-2 sm:px-4 animate-in fade-in zoom-in duration-500">
        
      {/* 1. Header Section */}
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-5xl font-serif text-neutral-900 dark:text-white mb-2">The Confidence Look</h2>
        <p className="text-lg md:text-xl text-neutral-500 dark:text-neutral-400 font-serif italic">"{result.overallVibe}"</p>
        
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
             <span>✨</span> {result.confidenceTip}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        
        {/* 2. Visual Section (Left Column) */}
        <div className="w-full lg:w-5/12 xl:w-4/12 flex-shrink-0">
             <div className="sticky top-24 space-y-6">
                <div className="bg-white dark:bg-neutral-900 p-2 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl">
                    {/* Tabs */}
                    <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl mb-2">
                        <button 
                            onClick={() => handleModeChange('2D')}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${viewMode === '2D' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900'}`}
                        >
                            Fashion Sketch
                        </button>
                        <button 
                            onClick={() => handleModeChange('REAL')}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${viewMode === 'REAL' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900'}`}
                        >
                            Real Look
                        </button>
                    </div>

                    {/* Image Container */}
                    <div className="aspect-[3/4] bg-neutral-50 dark:bg-neutral-800 rounded-2xl overflow-hidden relative border border-neutral-100 dark:border-neutral-700">
                        {isLoadingReal ? (
                             <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-pulse">
                                <span className="text-4xl mb-4">📸</span>
                                <h3 className="font-bold text-neutral-900 dark:text-white">Generating Realism...</h3>
                                <p className="text-sm text-neutral-500 mt-2">Creating a 4K photorealistic render based on your profile.</p>
                            </div>
                        ) : isLoading2D ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-pulse">
                                <span className="text-4xl mb-4">✏️</span>
                                <h3 className="font-bold text-neutral-900 dark:text-white">Sketching Outfit...</h3>
                                <p className="text-sm text-neutral-500 mt-2">Our AI artist is drawing your look.</p>
                            </div>
                        ) : currentImage ? (
                            <img src={currentImage} alt="Outfit Visual" className="w-full h-full object-cover animate-in fade-in duration-700" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-neutral-400">
                                <span className="text-4xl mb-2">🖼️</span>
                                <p>Select a mode to view.</p>
                            </div>
                        )}
                        
                        {/* Mode Badge */}
                        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-white/10">
                            {viewMode === '2D' ? 'AI Sketch Mode' : 'AI Realism Mode'}
                        </div>
                    </div>
                </div>

                {/* Grooming Note */}
                <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 p-5 rounded-2xl">
                    <h4 className="text-primary-700 dark:text-primary-300 font-bold uppercase tracking-wider text-xs mb-2">Grooming Advice</h4>
                    <p className="font-serif text-lg text-neutral-900 dark:text-white mb-1">{result.hairstyle}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{result.hairstyleReasoning}</p>
                </div>
             </div>
        </div>

        {/* 3. Details Section (Right Column) */}
        <div className="w-full lg:w-7/12 xl:w-8/12 space-y-10">
            
            {/* A. Wardrobe Items */}
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <span className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-sm">✓</span>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white">From Your Wardrobe</h3>
                </div>
                
                {wardrobeItems.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {wardrobeItems.map((item, idx) => (
                            <ItemCard key={idx} item={item} type={item.type} />
                        ))}
                    </div>
                ) : (
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 text-center text-neutral-500">
                        <p>No suitable items found in your wardrobe for this specific look.</p>
                    </div>
                )}
            </section>

            {/* B. Shopping Items */}
            {shoppingItems.length > 0 && (
                <section className="bg-gradient-to-br from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-950 p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 text-sm">🛍️</span>
                            <div>
                                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Shop The Look</h3>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">These items complete your outfit.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {shoppingItems.map((item, idx) => (
                                <ItemCard key={idx} item={item} type={item.type} isShopping={true} />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Action Buttons */}
            <div className="pt-8 flex justify-center">
                <button
                    onClick={onReset}
                    className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl"
                >
                    Style Another Occasion
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default ResultDisplay;