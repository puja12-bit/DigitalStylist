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

// ---------- 1) PROFILE FROM IMAGE ----------
export const analyzeUserProfileFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Partial<UserProfile>> => {
  return await postJson<Partial<UserProfile>>("/api/analyze-profile-image", {
    base64Image,
    mimeType
  });
};

// ---------- 2) WARDROBE FROM IMAGE ----------
export const analyzeWardrobeFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<WardrobeItem[]> => {
  return await postJson<WardrobeItem[]>("/api/analyze-wardrobe-image", {
    base64Image,
    mimeType
  });
};

// ---------- 3) OUTFIT TEXT ----------
export const generateOutfit = async (
  profile: UserProfile,
  wardrobe: WardrobeItem[],
  occasion: string
): Promise<OutfitRecommendation> => {
  return await postJson<OutfitRecommendation>("/api/generate-outfit", {
    profile,
    wardrobe,
    occasion
  });
};

// ---------- 4) OUTFIT IMAGE (SKETCH / REAL) ----------
export const generateOutfitImage = async (
  recommendation: OutfitRecommendation,
  profile: UserProfile,
  mode: "2D" | "REAL"
): Promise<string | null> => {
  const backendMode = mode === "2D" ? "sketch" : "real";

  const data = await postJson<{ imageDataUrl: string }>(
    "/api/outfit-image",
    {
      recommendation,
      profile,
      mode: backendMode
    }
  );

  return data.imageDataUrl || null;
};
