// ---- ORIGINAL WORKING VERSION (before sketch/real changes) ----
// Uses backend routes exactly as your server.js expects.

export async function analyzeUserProfileFromImage(base64Image, mimeType) {
  const resp = await fetch("/api/analyze-profile-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image, mimeType }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Request to /api/analyze-profile-image failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

export async function analyzeWardrobeFromImage(base64Image, mimeType) {
  const resp = await fetch("/api/analyze-wardrobe-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image, mimeType }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Request to /api/analyze-wardrobe-image failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

export async function generateOutfit(profile, wardrobe, occasion) {
  const resp = await fetch("/api/generate-outfit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, wardrobe, occasion }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Request to /api/generate-outfit failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

export async function generateOutfitImage(recommendation, profile, mode) {
  const resp = await fetch("/api/outfit-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recommendation,
      profile,
      mode, // earlier working file already supported passing mode
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Request to /api/outfit-image failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return data.imageDataUrl || null;
}

export default {
  analyzeUserProfileFromImage,
  analyzeWardrobeFromImage,
  generateOutfit,
  generateOutfitImage,
};
