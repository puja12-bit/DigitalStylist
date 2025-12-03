// src/types.ts

export interface User {
  id: string;
  name: string;
  email: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  style?: string;
  colors?: string[];
  budget?: string;
}

export interface WardrobeItem {
  id: string;
  imageUrl: string;
  type: 'top' | 'bottom' | 'shoes' | 'accessory' | 'full-body';
  tags?: string[];
  description?: string;
}

export interface ImageResult {
  file: File;
  preview: string;
}

export interface AnalysisResult {
  matchScore: number;
  advice: string;
  outfitIdeas: string[];
  colorAnalysis?: string;
  occasionSuitability?: string[];
}

export interface HistoryItem {
  id: string;
  date: string;
  image: string;
  analysis: AnalysisResult;
}
