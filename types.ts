
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
  userId?: string; // Added for Backend Link
  name: string;
  heightCm: number;
  weightKg: number;
  skinTone: SkinTone;
  facialFeatures: string; 
  gender: string;
  avatarImage?: string; // Base64 string of the user's photo
}

export interface WardrobeItem {
  id: string;
  userId?: string; // Added for Backend Link
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
  userId?: string; // Added for Backend Link
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
  generatedImage: string | null; // The 2D Sketch
  generatedImageReal: string | null; // The Photorealistic Image
  history: HistoryEntry[];
  isLoading: boolean;
  error: string | null;
}
