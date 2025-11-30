
import React, { useState, useRef } from 'react';
import { UserProfile, SkinTone } from '../types';
import { analyzeUserProfileFromImage } from '../services/geminiService';

interface Props {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onNext: () => void;
}

const ProfileForm: React.FC<Props> = ({ profile, onSave, onNext }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof UserProfile, value: string | number) => {
    onSave({ ...profile, [field]: value });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        const apiKey = process.env.API_KEY || '';
        const analysis = await analyzeUserProfileFromImage(apiKey, base64String, file.type);
        
        onSave({
          ...profile,
          ...analysis,
          avatarImage: base64String // Save for later "Real" generation
        });
      } catch (error) {
        console.error("Failed to analyze image", error);
        alert("Could not analyze image. Please fill details manually.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif text-neutral-900 dark:text-white mb-2">Your Style Profile</h2>
        <p className="text-neutral-500 dark:text-neutral-400">Let AI analyze your features for the perfect match, or enter them manually.</p>
      </div>

      <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm mb-8 transition-colors duration-300">
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div>
            <h3 className="text-lg font-medium text-primary-600 flex items-center gap-2">
              ✨ AI Auto-Analysis
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Upload a photo to instantly detect skin tone, face shape, and body type.</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="w-full sm:w-auto px-6 py-3 bg-neutral-900 dark:bg-neutral-700 hover:bg-neutral-800 dark:hover:bg-neutral-600 disabled:bg-neutral-400 text-white font-medium rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            aria-busy={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Upload Photo
              </>
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleImageUpload}
            aria-label="Upload photo for analysis"
          />
        </div>
        {profile.avatarImage && (
             <div className="mt-4 flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Photo saved for realistic outfit generation.
             </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Gender Identity</label>
          <div className="grid grid-cols-3 gap-3">
             {['Male', 'Female', 'Non-Binary'].map(g => (
                 <button
                    key={g}
                    onClick={() => handleChange('gender', g)}
                    className={`p-3 rounded-lg border transition-all text-sm font-medium ${
                        profile.gender === g
                        ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300 shadow-sm'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                 >
                     {g}
                 </button>
             ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="relative group">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Height (cm)</label>
            <input
              type="number"
              value={profile.heightCm}
              onChange={(e) => handleChange('heightCm', Number(e.target.value))}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 focus:border-primary-400 outline-none transition-all"
            />
          </div>
          <div className="relative group">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Weight (kg)</label>
            <input
              type="number"
              value={profile.weightKg}
              onChange={(e) => handleChange('weightKg', Number(e.target.value))}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 focus:border-primary-400 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Skin Tone</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Object.values(SkinTone).map((tone) => (
              <button
                key={tone}
                onClick={() => handleChange('skinTone', tone)}
                className={`p-2 rounded-lg text-sm border transition-all ${
                  profile.skinTone === tone
                    ? 'bg-primary-600 text-white border-primary-600 shadow-md transform scale-105'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Facial Features</label>
          <textarea
            value={profile.facialFeatures}
            onChange={(e) => handleChange('facialFeatures', e.target.value)}
            placeholder="e.g. Oval face, wears glasses, beard, short hair..."
            className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900 focus:border-primary-400 outline-none h-24 resize-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
          />
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full mt-10 bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-500/20 transform transition-transform hover:scale-[1.01]"
      >
        Save & Continue
      </button>
    </div>
  );
};

export default ProfileForm;
