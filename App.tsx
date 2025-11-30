
import React, { useState, useEffect } from 'react';
import { UserProfile, WardrobeItem, OutfitRecommendation, SkinTone, User, HistoryEntry, AppState } from './types';
import ProfileForm from './components/ProfileForm';
import WardrobeManager from './components/WardrobeManager';
import ResultDisplay from './components/ResultDisplay';
import Auth from './components/Auth';
import History from './components/History';
import { generateOutfit, generateOutfitImage } from './services/geminiService';
import { backend } from './services/backend';

const App: React.FC = () => {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppState['view']>('auth'); // Initial view
  const [appReady, setAppReady] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile>({
    name: 'User',
    heightCm: 175,
    weightKg: 70,
    skinTone: SkinTone.Medium,
    facialFeatures: '',
    gender: 'Male'
  });
  
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [occasion, setOccasion] = useState('');
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(null);
  
  const [generatedImage, setGeneratedImage] = useState<string | null>(null); // 2D
  const [generatedImageReal, setGeneratedImageReal] = useState<string | null>(null); // Real
  
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  
  const [isLoading, setIsLoading] = useState(false); // For Main Text Gen
  const [isGenerating2D, setIsGenerating2D] = useState(false); // For Background Image Gen
  
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const API_KEY = process.env.API_KEY || '';

  // Theme Logic
  useEffect(() => {
    const storedTheme = localStorage.getItem('styleConfident_theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (storedTheme) {
      setTheme(storedTheme);
    } else if (systemPrefersDark) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('styleConfident_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // 1. App Initialization & Backend Hydration
  useEffect(() => {
    const initApp = async () => {
      await backend.init();
      const currentUser = await backend.auth.getCurrentUser();
      
      if (currentUser) {
        setUser(currentUser);
        // Load Data in parallel
        const [loadedProfile, loadedWardrobe, loadedHistory] = await Promise.all([
          backend.user.getProfile(currentUser.id),
          backend.wardrobe.getAll(currentUser.id),
          backend.history.getAll(currentUser.id)
        ]);

        if (loadedProfile) setProfile(loadedProfile);
        setWardrobe(loadedWardrobe);
        
        // Sort history by time descending
        setHistory(loadedHistory.sort((a, b) => b.timestamp - a.timestamp));
        
        setView('profile');
      } else {
        setView('auth');
      }
      setAppReady(true);
    };

    initApp();
  }, []);

  // Handler: Login
  const handleLogin = async (newUser: User) => {
    await backend.auth.login(newUser.email, newUser.name);
    setUser(newUser);
    
    // Attempt to load existing data if re-logging in
    const [loadedProfile, loadedWardrobe, loadedHistory] = await Promise.all([
        backend.user.getProfile(newUser.id),
        backend.wardrobe.getAll(newUser.id),
        backend.history.getAll(newUser.id)
    ]);
    
    if (loadedProfile) setProfile(loadedProfile);
    else {
        // Reset profile for new user
        setProfile({ name: newUser.name, heightCm: 175, weightKg: 70, skinTone: SkinTone.Medium, facialFeatures: '', gender: 'Male' });
    }
    
    setWardrobe(loadedWardrobe);
    setHistory(loadedHistory.sort((a, b) => b.timestamp - a.timestamp));

    setView('profile');
  };

  // Handler: Logout
  const handleLogout = async () => {
    await backend.auth.logout();
    setUser(null);
    setView('auth');
    setRecommendation(null);
    setOccasion('');
    setHistory([]);
    setWardrobe([]);
    setGeneratedImage(null);
    setGeneratedImageReal(null);
  };

  // Handler: Update Profile & Persist
  const handleUpdateProfile = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    if (user) {
        await backend.user.updateProfile(user.id, newProfile);
    }
  };

  // Handler: Update Wardrobe & Persist
  const handleUpdateWardrobe = async (newWardrobe: WardrobeItem[]) => {
    setWardrobe(newWardrobe);
    if (user) {
        await backend.wardrobe.sync(user.id, newWardrobe);
    }
  };

  // Handler: Save to History
  const saveToHistory = async (rec: OutfitRecommendation, imgUrl: string | null, imgUrlReal: string | null) => {
    if (!user) return;
    
    const newEntry: HistoryEntry = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        timestamp: Date.now(),
        occasion: occasion,
        recommendation: rec,
        generatedImageUrl: imgUrl || undefined,
        generatedImageRealUrl: imgUrlReal || undefined
    };

    const newHistory = [newEntry, ...history];
    setHistory(newHistory);
    
    // Save to Backend
    await backend.history.add(user.id, newEntry);
  };

  const handleClearHistory = async () => {
      if (!user) return;
      setHistory([]);
      await backend.history.clear(user.id);
  };

  const handleGenerate = async () => {
    if (!occasion) return;
    
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setGeneratedImageReal(null);
    setRecommendation(null);
    
    try {
      if (!API_KEY) {
        throw new Error("System Error: API Key is missing. Please contact support or check configuration.");
      }
      
      // 1. Generate Text Recommendation
      const result = await generateOutfit(API_KEY, profile, wardrobe, occasion);
      setRecommendation(result);
      setView('result');
      
      // Stop blocking UI
      setIsLoading(false);
      
      // 2. Start Visual (2D default) in background
      setIsGenerating2D(true);
      generateOutfitImage(API_KEY, result, profile, '2D')
        .then((imageResult) => {
           setGeneratedImage(imageResult);
           // 3. Save to History only after we have the initial image
           saveToHistory(result, imageResult, null);
        })
        .finally(() => {
           setIsGenerating2D(false);
        });

    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setIsLoading(false);
    }
  };

  const handleGenerateReal = async () => {
      if (!recommendation || !API_KEY || !user) return;
      if (generatedImageReal) return;

      try {
        const realImage = await generateOutfitImage(API_KEY, recommendation, profile, 'REAL');
        setGeneratedImageReal(realImage);
        
        // Update history entry with the real image
        const updatedHistory = [...history];
        if (updatedHistory.length > 0) {
            // Update the most recent entry
            const currentEntry = updatedHistory[0];
            currentEntry.generatedImageRealUrl = realImage || undefined;
            setHistory(updatedHistory);
            
            // Persist the update to backend using upsert
            await backend.history.add(user.id, currentEntry);
        }

      } catch (e) {
        console.error("Failed to generate real image", e);
      }
  };

  const renderContent = () => {
    if (!appReady) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-96 animate-in fade-in duration-700" role="status" aria-live="polite">
           <div className="relative w-24 h-24 mb-8">
             <div className="absolute top-0 left-0 w-full h-full border-4 border-neutral-200 dark:border-neutral-800 rounded-full"></div>
             <div className="absolute top-0 left-0 w-full h-full border-4 border-primary-500 rounded-full border-t-transparent animate-spin"></div>
           </div>
           <h3 className="text-2xl font-serif text-neutral-900 dark:text-white">Curating Your Look...</h3>
           <p className="text-neutral-500 dark:text-neutral-400 mt-2 px-4 text-center">Analyzing {wardrobe.length} wardrobe items for "{occasion}"</p>
        </div>
      );
    }

    switch (view) {
      case 'auth':
        return <Auth onLogin={handleLogin} />;
        
      case 'history':
        return <History history={history} onBack={() => setView('result')} onClear={handleClearHistory} />;

      case 'result':
        if (!recommendation) return null;
        return (
            <ResultDisplay 
                result={recommendation} 
                generatedImage2D={generatedImage}
                generatedImageReal={generatedImageReal}
                isGenerating2D={isGenerating2D}
                onGenerateReal={handleGenerateReal}
                onReset={() => { setView('profile'); setRecommendation(null); setOccasion(''); setGeneratedImage(null); setGeneratedImageReal(null); }} 
            />
        );

      case 'profile':
        return <ProfileForm profile={profile} onSave={handleUpdateProfile} onNext={() => setView('wardrobe')} />;
        
      case 'wardrobe':
        return <WardrobeManager items={wardrobe} onUpdate={handleUpdateWardrobe} onNext={() => setView('occasion')} onBack={() => setView('profile')} />;
        
      case 'occasion':
        const firstName = user?.name.split(' ')[0] || 'there';
        return (
          <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-serif text-neutral-900 dark:text-white mb-3 leading-tight">
                Hi {firstName}, what's on your mind now?
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400 px-4">Be specific! The more detail, the better the fit.</p>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="e.g., Job Interview at a Tech Startup..."
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 text-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none placeholder:text-neutral-400 shadow-sm"
                autoFocus
                aria-label="Enter the occasion"
              />
              
              <div className="flex flex-wrap gap-2 justify-center">
                {['Job Interview', 'Wedding Guest', 'Casual Friday', 'First Date', 'Gym', 'Sunday Brunch'].map(occ => (
                  <button 
                    key={occ}
                    onClick={() => setOccasion(occ)}
                    className="px-4 py-2 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-sm rounded-full transition-colors border border-neutral-200 dark:border-neutral-700"
                  >
                    {occ}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-8">
              <button
                onClick={() => setView('wardrobe')}
                className="w-full sm:flex-1 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 font-bold py-4 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors order-2 sm:order-1"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={!occasion}
                className="w-full sm:flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-500/20 order-1 sm:order-2"
              >
                Get My Look ✨
              </button>
            </div>
            {error && <p className="text-red-500 text-center mt-4 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/50" role="alert">{error}</p>}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans transition-colors duration-300">
      
      {/* Navbar */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-primary-600">Skip to content</a>
      <nav className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => user && setView('profile')} role="button" aria-label="Go to profile">
                <div className="text-primary-600 transition-transform group-hover:scale-105 shrink-0">
                     {/* Real Hanger Icon */}
                     <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 8.35L3.6 14.5a1 1 0 0 0 .6 1.8h15.6a1 1 0 0 0 .6-1.8L12 8.35z" />
                        <path d="M12 8.35V5a3 3 0 0 0-3-3" />
                    </svg>
                </div>
                <div className="flex flex-col justify-center">
                    <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white leading-none">Style<span className="text-primary-600">Confident</span></span>
                    {/* Hide tagline on very small screens to save space */}
                    <span className="hidden sm:block text-[10px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">Your Personal Stylist</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
                 {/* Theme Toggle */}
                 <button 
                    onClick={toggleTheme} 
                    className="p-2 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                    aria-label="Toggle Dark Mode"
                >
                    {theme === 'light' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                    )}
                 </button>

                {user && (
                    <>
                        <button 
                            onClick={() => setView('history')}
                            className={`text-sm font-medium transition-colors hidden xs:block sm:block ${view === 'history' ? 'text-primary-600' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
                            aria-label="View Style History"
                        >
                            History
                        </button>
                        {/* Mobile History Icon Only */}
                        <button 
                            onClick={() => setView('history')}
                            className={`sm:hidden p-2 rounded-full ${view === 'history' ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-neutral-500 dark:text-neutral-400'}`}
                            aria-label="View Style History"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
                        </button>

                        <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" aria-hidden="true"></div>
                        <button 
                            onClick={handleLogout}
                            className="text-xs text-neutral-400 hover:text-red-500 transition-colors whitespace-nowrap"
                            aria-label="Sign out"
                        >
                            Sign Out
                        </button>
                    </>
                )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {renderContent()}
      </main>
      
    </div>
  );
};

export default App;
