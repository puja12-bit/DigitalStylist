import {
  UserProfile,
  WardrobeItem,
  OutfitRecommendation
} from "../types";

const postJson = async <T>(url: string, body: any): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Request to ${url} failed (${res.status}): ${text || "Unknown error"}`
    );
  }

  return res.json() as Promise<T>;
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
// 4) Generate outfit image (fashion sketch / real look)
// -------------------------------------------------------
export const generateOutfitImage = async (
  recommendation: OutfitRecommendation,
  profile: UserProfile,
  mode: "FASHION_SKETCH" | "REAL_LOOK"
): Promise<string | null> => {
  try {
    if (!profile.avatarImage) {
      throw new Error("No profile image available for visualization.");
    }

    const data = await postJson<{ imageDataUrl: string }>(
      "/api/outfit-image",
      {
        recommendation,
        profile,
        mode
      }
    );

    return data.imageDataUrl || null;
  } catch (err: any) {
    console.error("generateOutfitImage error:", err);
    throw new Error(
      err?.message || "Failed to generate outfit image on server."
    );
  }
};
