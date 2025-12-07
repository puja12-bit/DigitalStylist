import {
  UserProfile,
  WardrobeItem,
  OutfitRecommendation
} from "../types";

// Generic helper to call our backend
const postJson = async <T>(url: string, body: any): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Request to ${url} failed (${res.status}): ${text || "Unknown error"}`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text}`);
  }
};

// -------------------------------------------------------
// 1) Analyze user profile from image
// -------------------------------------------------------
export const analyzeUserProfileFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Partial<UserProfile>> => {
  try {
    return await postJson<Partial<UserProfile>>(
      "/api/analyze-profile-image",
      { base64Image, mimeType }
    );
  } catch (err: any) {
    console.error("analyzeUserProfileFromImage error:", err);
    throw new Error(
      err?.message || "Failed to analyze profile image on server."
    );
  }
};

// -------------------------------------------------------
// 2) Analyze wardrobe from image
// -------------------------------------------------------
export const analyzeWardrobeFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<WardrobeItem[]> => {
  try {
    return await postJson<WardrobeItem[]>(
      "/api/analyze-wardrobe-image",
      { base64Image, mimeType }
    );
  } catch (err: any) {
    console.error("analyzeWardrobeFromImage error:", err);
    throw new Error(
      err?.message || "Failed to analyze wardrobe image on server."
    );
  }
};

// -------------------------------------------------------
// 3) Generate outfit (text)
// -------------------------------------------------------
export const generateOutfit = async (
  profile: UserProfile,
  wardrobe: WardrobeItem[],
  occasion: string
): Promise<OutfitRecommendation> => {
  try {
    return await postJson<OutfitRecommendation>("/api/generate-outfit", {
      profile,
      wardrobe,
      occasion
    });
  } catch (err: any) {
    console.error("generateOutfit error:", err);
    throw new Error(
      err?.message || "Failed to generate outfit on server."
    );
  }
};

// -------------------------------------------------------
// 4) Generate outfit image (Fashion Sketch / Real Look)
// -------------------------------------------------------
//
// IMPORTANT:
// Your existing UI uses "2D" for Fashion Sketch and "REAL" for Real Look.
// The backend expects "FASHION_SKETCH" or "REAL_LOOK".
// This function maps between them.
//

export const generateOutfitImage = async (
  recommendation: OutfitRecommendation,
  profile: UserProfile,
  style: '2D' | 'REAL' = '2D'
): Promise<string | null> => {
  
  // Create a detailed description of the user so the "Real" image looks like them
  const prompt = `
    Subject: Full body fashion shot of a ${profile.gender} model.
    Physical Details: ${profile.skinTone} skin tone, ${profile.estimatedHeightCm}cm height, ${profile.estimatedWeightKg}kg weight body type.
    Facial Features: ${profile.facialFeatures}.
    
    Wearing Outfit:
    - Top: ${recommendation.top.color} ${recommendation.top.name}
    - Bottom: ${recommendation.bottom.color} ${recommendation.bottom.name}
    - Shoes: ${recommendation.shoes.color} ${recommendation.shoes.name}
    
    Pose: Standing confidently looking at camera.
  `;

  try {
    // Send request to our own server (which handles the Credits & Vertex AI)
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style })
    });

    const data = await response.json();

    if (data.success && data.image) {
      return data.image; // Returns the high-quality image
    } else {
      console.error("Image Generation Failed:", data.error);
      return null;
    }

  } catch (error) {
    console.error("Network Error:", error);
    return null;
  }
};
