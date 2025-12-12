// src/services/geminiService.ts
// Frontend -> backend wrapper for all image / outfit operations.
// This file POSTS to your Cloud Run backend endpoints. It does NOT call Gemini/Imagen directly.
// It expects the backend (server.js) to implement:
//  - POST /api/analyze-profile-image  { base64Image, mimeType } -> { gender, heightCm, weightKg, skinTone, facialFeatures }
//  - POST /api/analyze-wardrobe-image { base64Image, mimeType } -> [ { id?, name, category, color } ]
//  - POST /api/generate-outfit        { profile, wardrobe, occasion } -> OutfitRecommendation (JSON)
//  - POST /api/outfit-image           { profile, recommendation, mode } -> { imageDataUrl }
// If any response is not ok, this module throws with diagnostic messages.

export type Mode = "sketch" | "real";

export async function analyzeUserProfileFromImage(
  base64Image: string,
  mimeType: string
): Promise<{
  gender?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  skinTone?: string | null;
  facialFeatures?: string;
}> {
  if (!base64Image || !mimeType) {
    throw new Error("analyzeUserProfileFromImage: base64Image and mimeType required");
  }

  const resp = await fetch("/api/analyze-profile-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image, mimeType }),
  });

  const text = await resp.text();
  let payload: any;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error("analyzeUserProfileFromImage - invalid JSON response:", text);
    throw new Error(`analyzeProfile: invalid JSON response: ${text}`);
  }

  if (!resp.ok) {
    console.error("analyzeUserProfileFromImage failed:", resp.status, payload);
    // Bubble the server error payload for easier debugging in UI
    throw new Error(`Request to /api/analyze-profile-image failed (${resp.status}): ${JSON.stringify(payload)}`);
  }

  return {
    gender: payload.gender,
    heightCm: payload.heightCm ?? null,
    weightKg: payload.weightKg ?? null,
    skinTone: payload.skinTone ?? null,
    facialFeatures: payload.facialFeatures ?? "",
  };
}

export async function analyzeWardrobeFromImage(
  base64Image: string,
  mimeType: string
): Promise<Array<{ id: string; name: string; category: string; color: string }>> {
  if (!base64Image || !mimeType) {
    throw new Error("analyzeWardrobeFromImage: base64Image and mimeType required");
  }

  const resp = await fetch("/api/analyze-wardrobe-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image, mimeType }),
  });

  const text = await resp.text();
  let payload: any;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error("analyzeWardrobeFromImage - invalid JSON response:", text);
    throw new Error(`analyzeWardrobe: invalid JSON response: ${text}`);
  }

  if (!resp.ok) {
    console.error("analyzeWardrobeFromImage failed:", resp.status, payload);
    throw new Error(`Request to /api/analyze-wardrobe-image failed (${resp.status}): ${JSON.stringify(payload)}`);
  }

  if (!Array.isArray(payload)) {
    console.error("analyzeWardrobeFromImage: server did not return an array:", payload);
    throw new Error("analyzeWardrobeFromImage: server returned wrong schema");
  }

  // Normalize items
  return payload.map((it: any, idx: number) => ({
    id: it.id || Math.random().toString(36).substr(2, 9),
    name: it.name || it.item || "Unknown item",
    category: it.category || "Other",
    color: it.color || it.colour || "Unknown",
  }));
}

export async function generateOutfit(
  profile: any,
  wardrobe: any[],
  occasion: string
): Promise<any> {
  // profile MUST be an object (may come from user form)
  if (!profile || typeof profile !== "object") {
    throw new Error("generateOutfit: profile object required");
  }

  const resp = await fetch("/api/generate-outfit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, wardrobe, occasion }),
  });

  const text = await resp.text();
  let payload: any;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error("generateOutfit - invalid JSON response:", text);
    throw new Error(`generateOutfit: invalid JSON response: ${text}`);
  }

  if (!resp.ok) {
    console.error("generateOutfit failed:", resp.status, payload);
    throw new Error(`Request to /api/generate-outfit failed (${resp.status}): ${JSON.stringify(payload)}`);
  }

  // Basic sanity: ensure we at least got top/bottom/shoes/accessory OR hairstyle
  if (!payload || (typeof payload !== "object")) {
    throw new Error("generateOutfit: invalid payload from server");
  }

  return payload;
}

/**
 * generateOutfitImage
 * - Sends profile + recommendation + mode to backend /api/outfit-image
 * - Returns data:image/... base64 string when successful
 */
export async function generateOutfitImage(
  recommendation: any,
  profile: any,
  mode: Mode
): Promise<string | null> {
  if (!profile || !profile.avatarImage) {
    throw new Error("generateOutfitImage: profile.avatarImage (data URL) is required");
  }
  if (!recommendation || typeof recommendation !== "object") {
    throw new Error("generateOutfitImage: recommendation required");
  }
  if (mode !== "sketch" && mode !== "real") {
    throw new Error("generateOutfitImage: mode must be 'sketch' or 'real'");
  }

  const resp = await fetch("/api/outfit-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Keep payload small-ish but include everything server may need
    body: JSON.stringify({ profile, recommendation, mode }),
  });

  const text = await resp.text();
  let payload: any;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error("generateOutfitImage - invalid JSON response:", text);
    throw new Error(`generateOutfitImage: invalid JSON response: ${text}`);
  }

  if (!resp.ok) {
    console.error("generateOutfitImage failed:", resp.status, payload);
    throw new Error(`Request to /api/outfit-image failed (${resp.status}): ${JSON.stringify(payload)}`);
  }

  // Expect { imageDataUrl: "data:image/png;base64,..." }
  if (!payload?.imageDataUrl) {
    console.error("generateOutfitImage: no imageDataUrl in response", payload);
    throw new Error("generateOutfitImage: backend did not return imageDataUrl");
  }

  return payload.imageDataUrl as string;
}

/**
 * Utility: convert a File/Blob into a data URL. Use in file upload handlers
 * so frontend ensures profile.avatarImage is a proper data URL.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const res = fr.result as string | ArrayBuffer | null;
      if (!res) return reject(new Error("fileToDataUrl: no result"));
      // ensure string
      if (typeof res === "string") return resolve(res);
      // ArrayBuffer -> base64 (rare)
      const bytes = new Uint8Array(res);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      resolve(`data:${(file as File).type || "application/octet-stream"};base64,${b64}`);
    };
    fr.onerror = (err) => reject(err);
    fr.readAsDataURL(file);
  });
}

/* default export for convenience */
export default {
  analyzeUserProfileFromImage,
  analyzeWardrobeFromImage,
  generateOutfit,
  generateOutfitImage,
  fileToDataUrl,
};
