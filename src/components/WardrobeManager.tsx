import React, { useState, useRef } from 'react';
import { WardrobeItem } from '../types';
import { analyzeWardrobeFromImage } from '../services/geminiService';

interface Props {
  items: WardrobeItem[];
  onUpdate: (items: WardrobeItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const WardrobeManager: React.FC<Props> = ({ items, onUpdate, onNext, onBack }) => {
  const [newItemName, setNewItemName] = useState('');
  const [newItemColor, setNewItemColor] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<WardrobeItem['category']>('Top');
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addItem = () => {
    if (!newItemName || !newItemColor) return;
    const newItem: WardrobeItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: newItemName,
      color: newItemColor,
      category: newItemCategory,
    };
    onUpdate([...items, newItem]);
    setNewItemName('');
    setNewItemColor('');
  };

  const removeItem = (id: string) => {
    onUpdate(items.filter(item => item.id !== id));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        // Correct env var access for Vite
        const apiKey = (import.meta as any).env.VITE_API_KEY || ''; 
        const newItems = await analyzeWardrobeFromImage(apiKey, base64String, file.type);
        onUpdate([...items, ...newItems]);
      } catch (error) {
        console.error("Failed to analyze wardrobe image", error);
        alert("Could not identify items. Please try again with a clearer photo.");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-serif text-neutral-900 dark:text-white mb-2">Digital Wardrobe</h2>
        <p className="text-neutral-500 dark:text-neutral-400 px-4">Add items manually or snap a picture of your clothes to auto-detect them.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Scan Option */}
        <div className="bg-gradient-to-br from-primary-50 to-white dark:from-neutral-800 dark:to-neutral-900 border border-primary-100 dark:border-neutral-700 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm transition-colors duration-300">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13l2 2 4-4"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Scan Your Closet</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Upload a photo of your clothes (even a pile!) and AI will list them for you.</p>
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="w-full py-3 bg-neutral-900 dark:bg-neutral-700 hover:bg-neutral-800 dark:hover:bg-neutral-600 text-white rounded-xl font-medium transition-colors shadow-lg disabled:opacity-70 flex justify-center items-center gap-2"
                aria-live="polite"
            >
                {isScanning ? (
                    <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Scanning...
                    </>
                ) : (
                    'Upload Photo'
                )}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        </div>

        {/* Manual Add */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm transition-colors duration-300">
            <h3 className="text-lg font-semibold text-primary-600 mb-4">Manual Entry</h3>
            <div className="space-y-3">
                 <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as any)}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 text-sm text-neutral-900 dark:text-white outline-none focus:border-primary-400 transition-colors"
                  >
                    <option value="Top">Top</option>
                    <option value="Bottom">Bottom</option>
                    <option value="Shoes">Shoes</option>
                    <option value="Outerwear">Outerwear</option>
                    <option value="Accessory">Accessory</option>
                  </select>
                <input
                  type="text"
                  placeholder="Color (e.g. Navy)"
                  value={newItemColor}
                  onChange={(e) => setNewItemColor(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 text-sm text-neutral-900 dark:text-white outline-none focus:border-primary-400 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Item Name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 text-sm text-neutral-900 dark:text-white outline-none focus:border-primary-400 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                />
                <button
                  onClick={addItem}
                  disabled={!newItemName || !newItemColor}
                  className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-bold rounded-lg transition-colors"
                >
                  Add Item
                </button>
            </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm transition-colors duration-300">
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4 px-2">Your Collection ({items.length})</h3>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {items.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl">
                 {/* Empty State Illustration using aria-hidden */}
                <p className="text-neutral-400 dark:text-neutral-500" aria-hidden="true">👕</p>
                <p className="text-neutral-400 dark:text-neutral-500 mt-2">Your wardrobe is empty.</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-600 mt-1">Start by scanning or adding basics.</p>
            </div>
            ) : (
            items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800 group hover:border-primary-200 dark:hover:border-primary-800 transition-all">
                <div className="flex items-center gap-4 overflow-hidden">
                    <span className="shrink-0 w-10 h-10 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-xl shadow-sm">
                    {item.category === 'Top' && '👕'}
                    {item.category === 'Bottom' && '👖'}
                    {item.category === 'Shoes' && '👟'}
                    {item.category === 'Accessory' && '⌚'}
                    {item.category === 'Outerwear' && '🧥'}
                    </span>
                    <div className="min-w-0">
                    <p className="text-neutral-900 dark:text-neutral-200 font-medium truncate">{item.color} {item.name}</p>
                    <p className="text-xs text-neutral-400 uppercase tracking-wider">{item.category}</p>
                    </div>
                </div>
                <button
                    onClick={() => removeItem(item.id)}
                    className="text-neutral-400 hover:text-red-500 p-2 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${item.color} ${item.name}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
                </div>
            ))
            )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          onClick={onBack}
          className="w-full sm:flex-1 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-bold py-4 rounded-xl border border-neutral-200 dark:border-neutral-800 transition-colors order-2 sm:order-1"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="w-full sm:flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-500/30 order-1 sm:order-2"
        >
          Next: Occasion
        </button>
      </div>
    </div>
  );
};

export default WardrobeManager;