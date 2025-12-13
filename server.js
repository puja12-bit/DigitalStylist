// server.js — Gemini v1 + Imagen (STABLE, OCCASION-CORRECT, NO POSE COPYING)

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "40mb" }));
app.use(express.static(path.join(__dirname, "dist")));

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "";
const IMAGEN_LOCATION = process.env.IMAGEN_LOCATION || "us-central1";
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || "imagen-3.0-capability-001";

console.log("Server starting...");
console.log("PORT=", PORT, "GEMINI_MODEL=", GEMINI_MODEL, "PROJECT_ID_PRESENT=", !!PROJECT_ID);

/* =========================
   GEMINI TEXT HELPER
========================= */
async function callGeminiREST({ contents, generationConfig = {} }) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: generationConfig.temperature ?? 0.25,
        maxOutputTokens: generationConfig.maxOutputTokens ?? 600,
      },
    }),
  });

  const json = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(json));

  const parts = json?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || "").join("").trim();
  if (!text) throw new Error("Empty Gemini response");

  return text;
}

/* =========================
   GCP ACCESS TOKEN
========================= */
async function getAccessToken() {
  const resp = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } }
  );
  if (!resp.ok) throw new Error("Failed to fetch GCP token");
  return (await resp.json()).access_token;
}

/* =========================
   HEALTH
========================= */
app.get("/health", (_, res) => res.send("OK"));

/* =========================
   OUTFIT TEXT GENERATION
========================= */
app.post("/api/generate-outfit", async (req, res) => {
  try {
    const { profile = {}, wardrobe = [], occasion = "" } = req.body;

    const wardrobeText = wardrobe
      .map(w => `- ${w.color} ${w.name} (${w.category})`)
      .join("\n");

    const prompt = `
You are a professional fashion stylist.

OCCASION: "${occasion}"

RULES:
- Outfit MUST match the occasion context.
- If interview → professional, neutral, conservative.
- If gym → athletic, functional.
- If casual → relaxed everyday wear.
- NEVER suggest festive/ethnic clothing unless occasion explicitly says so.

USER:
Gender: ${profile.gender}
Skin tone: ${profile.skinTone}

WARDROBE (use first if suitable):
${wardrobeText || "(empty)"}

Return ONLY JSON:
{
 "top": { "name":"", "description":"", "color":"", "source":"Wardrobe|Shopping", "reasoning":"" },
 "bottom": { "name":"", "description":"", "color":"", "source":"Wardrobe|Shopping", "reasoning":"" },
 "shoes": { "name":"", "description":"", "color":"", "source":"Wardrobe|Shopping", "reasoning":"" },
 "accessory": { "name":"", "description":"", "color":"", "source":"Wardrobe|Shopping", "reasoning":"" },
 "hairstyle":"",
 "hairstyleReasoning":"",
 "confidenceTip":"",
 "overallVibe":""
}
`;

    const text = await callGeminiREST({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    res.json(JSON.parse(text.replace(/```json|```/g, "")));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   OUTFIT IMAGE (THE FIX)
========================= */
app.post("/api/outfit-image", async (req, res) => {
  try {
    const { profile = {}, recommendation = {}, mode = "sketch" } = req.body;

    if (!profile.avatarImage) {
      return res.status(400).json({ error: "profile.avatarImage required" });
    }
    if (!PROJECT_ID) {
      return res.status(500).json({ error: "PROJECT_ID not set" });
    }

    const avatarBase64 = profile.avatarImage.split(",")[1];

    const top = recommendation.top || {};
    const bottom = recommendation.bottom || {};
    const shoes = recommendation.shoes || {};

    /* -------- PROMPTS -------- */

    const sketchPrompt = `
Fashion illustration, flat 2D pencil sketch.
Single person standing straight, neutral pose.
Outfit:
${top.color} ${top.name},
${bottom.color} ${bottom.name},
${shoes.color} ${shoes.name}.
White background, clean fashion croquis.
No realism. No photo.
`;

    const realPrompt = `
Studio photograph of a person standing upright.
Neutral pose, arms relaxed.
Professional outfit:
${top.color} ${top.name},
${bottom.color} ${bottom.name},
${shoes.color} ${shoes.name}.
Plain studio background.
Photorealistic lighting.
`;

    const negativeSketch =
      "photo, photorealistic, camera, shadows, background, sitting, ethnic wear, kurta, couple, extra limbs";

    const negativeReal =
      "drawing, sketch, illustration, anime, cartoon, sitting, leaning, ethnic wear, kurta, wedding, couple, extra limbs";

    const prompt = mode === "real" ? realPrompt : sketchPrompt;
    const negativePrompt = mode === "real" ? negativeReal : negativeSketch;

    /* -------- IMAGEN CALL -------- */

    const token = await getAccessToken();
    const url = `https://${IMAGEN_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${IMAGEN_LOCATION}/publishers/google/models/${IMAGEN_MODEL}:predict`;

    const body = {
      instances: [
        {
          prompt,
          referenceImages: [
            {
              referenceType: "REFERENCE_TYPE_RAW",
              referenceImage: { bytesBase64Encoded: avatarBase64 },
            },
          ],
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "3:4",
        negativePrompt,
        personGeneration: "allow_adult",
        outputOptions: { mimeType: "image/png" },
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = await resp.json();
    const img = json?.predictions?.[0]?.bytesBase64Encoded;

    if (!img) {
      return res.status(500).json({ error: "No image returned", detail: json });
    }

    res.json({ imageDataUrl: `data:image/png;base64,${img}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   SPA FALLBACK
========================= */
app.get("*", (_, res) =>
  res.sendFile(path.join(__dirname, "dist", "index.html"))
);

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
