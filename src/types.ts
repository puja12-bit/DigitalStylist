export enum SkinTone {
  Fair = 'Fair',
  Light = 'Light',
  Medium = 'Medium',
  Olive = 'Olive',
  Tan = 'Tan',
  Dark = 'Dark',
  Deep = 'Deep'
}

export enum BodyType {
  Slim = 'Slim',
  Athletic = 'Athletic',
  Average = 'Average',
  Heavy = 'Heavy',
  PlusSize = 'Plus Size'
}

export interface User {
  id: string;
  name: string;
  email: string;
  joinedAt: number;
}

export interface UserProfile {
  userId?: string; 
  name: string;
  heightCm: number;
  weightKg: number;
  skinTone: SkinTone;
  facialFeatures: string; 
  gender: string;
  avatarImage?: string; 
}

export interface WardrobeItem {
  id: string;
  userId?: string; 
  name: string;
  category: 'Top' | 'Bottom' | 'Shoes' | 'Accessory' | 'Outerwear';
  color: string;
}

export interface RecommendedItem {
  name: string;
  description: string;
  color: string;
  source: 'Wardrobe' | 'Shopping';
  reasoning: string;
}

export interface OutfitRecommendation {
  top: RecommendedItem;
  bottom: RecommendedItem;
  shoes: RecommendedItem;
  accessory: RecommendedItem;
  hairstyle: string;
  hairstyleReasoning: string;
  confidenceTip: string;
  overallVibe: string;
}

export interface HistoryEntry {
  id: string;
  userId?: string; 
  timestamp: number;
  occasion: string;
  recommendation: OutfitRecommendation;
  generatedImageUrl?: string;
  generatedImageRealUrl?: string;
}

export interface AppState {
  view: 'auth' | 'profile' | 'wardrobe' | 'occasion' | 'result' | 'history';
  user: User | null;
  userProfile: UserProfile;
  wardrobe: WardrobeItem[];
  occasion: string;
  recommendation: OutfitRecommendation | null;
  generatedImage: string | null; 
  generatedImageReal: string | null; 
  history: HistoryEntry[];
  isLoading: boolean;
  error: string | null;
}