// server.js - REST Gemini v1 backend + Imagen (sketch + real) support
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
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash"; // ensure valid
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "";
const IMAGEN_LOCATION = process.env.IMAGEN_LOCATION || "us-central1";
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || "imagen-3.0-capability-001";

console.log("Server starting...");
console.log("PORT=", PORT, "GEMINI_MODEL=", GEMINI_MODEL, "GEMINI_KEY_PRESENT=", !!GEMINI_API_KEY, "PROJECT_ID_PRESENT=", !!PROJECT_ID);

// ----------------- Helper: call Gemini v1 REST -----------------
async function callGeminiREST({ model = GEMINI_MODEL, contents = [], generationConfig = {} }) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing on server");
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;

  const body = {
    contents,
    generationConfig: {
      temperature: generationConfig.temperature ?? 0.3,
      topK: generationConfig.topK ?? 40,
      topP: generationConfig.topP ?? 0.95,
      maxOutputTokens: generationConfig.maxOutputTokens ?? 512,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await resp.json();
  if (!resp.ok) {
    const msg = `[Gemini REST ${resp.status}] ${JSON.stringify(json)}`;
    const e = new Error(msg);
    e.meta = json;
    throw e;
  }

  const candidate = json?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join(" ").trim();
  if (!text) throw new Error("Empty text response from Gemini");
  return { text, raw: json };
}

// ----------------- Helper: get access token for Imagen -----------------
async function getAccessToken() {
  // Works only on GCP (Cloud Run) with a service account.
  const resp = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: { "Metadata-Flavor": "Google" },
    }
  );
  if (!resp.ok) throw new Error("Failed to fetch GCP metadata token");
  const j = await resp.json();
  return j.access_token;
}

// ----------------- Routes -----------------
app.get("/health", (_req, res) => res.status(200).send("OK"));

// ---- PROFILE ANALYSIS ----
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    if (!base64Image || !mimeType) return res.status(400).json({ error: "base64Image and mimeType required" });

    const contentData = base64Image.split(",")[1] || base64Image;

    const prompt = `
Analyze the provided photo for a fashion styling application. Return EXACTLY a JSON object with:
{
  "gender": "Male|Female|Non-binary|uncertain",
  "heightCm": 170,
  "weightKg": 65,
  "skinTone": "Fair|Light|Medium|Olive|Tan|Dark|Deep",
  "facialFeatures": "One or two short sentences describing face shape, brows, nose, lips, eyes, hairstyle."
}
Keep facialFeatures 1-2 short sentences. Return only JSON.
`;

    const contents = [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: contentData } },
          { text: prompt },
        ],
      },
    ];

    const { text } = await callGeminiREST({
      contents,
      generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
    });

    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse Gemini JSON", responseText: cleaned });
    }

    const out = {
      gender: parsed.gender ?? "uncertain",
      heightCm: parsed.heightCm ?? parsed.estimatedHeightCm ?? null,
      weightKg: parsed.weightKg ?? parsed.estimatedWeightKg ?? null,
      skinTone: parsed.skinTone ?? parsed.skin_tone ?? null,
      facialFeatures: parsed.facialFeatures ?? parsed.facial_features ?? "",
    };

    return res.json(out);
  } catch (err) {
    console.error("analyze-profile-image error:", err);
    return res.status(500).json({ error: err.message || "Profile analysis failed", detail: err.meta ?? null });
  }
});

// ---- WARDROBE ANALYSIS ----
app.post("/api/analyze-wardrobe-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    if (!base64Image || !mimeType) return res.status(400).json({ error: "base64Image and mimeType required" });

    const contentData = base64Image.split(",")[1] || base64Image;

    const prompt = `
You are a fashion AI that lists clothing items in an image.
Return ONLY a JSON array where each item has:
{ "name":"short name", "category":"Top|Bottom|Dress|Shoes|Accessory|Outerwear|Other", "color":"primary color" }
Do not add any extra text.
`;

    const contents = [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: contentData } },
          { text: prompt },
        ],
      },
    ];

    const { text } = await callGeminiREST({
      contents,
      generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
    });

    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("Gemini did not return an array");
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse wardrobe JSON", responseText: cleaned });
    }

    const items = parsed.map((it) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: it.name || it.item || "Unknown item",
      category: it.category || "Other",
      color: it.color || it.colour || "Unknown",
    }));

    return res.json(items);
  } catch (err) {
    console.error("analyze-wardrobe-image error:", err);
    return res.status(500).json({ error: err.message || "Wardrobe analysis failed", detail: err.meta ?? null });
  }
});

// ---- OUTFIT GENERATION ----
app.post("/api/generate-outfit", async (req, res) => {
  try {
    const { profile = {}, wardrobe = [], occasion = "" } = req.body || {};

    const wardrobeList = (wardrobe || []).map((w) => `- ${w.color} ${w.name} (${w.category})`).join("\n");

    const o = (occasion || "").toLowerCase();
    let occasionRules = "General smart-casual outfit.";
    if (o.includes("interview")) {
      occasionRules = `
OCCASION CATEGORY: JOB INTERVIEW
RULES:
- MUST look professional and reliable.
- FORBIDDEN: shiny fabrics, heavy festive/wedding outfits (kurta pajama, lehenga, sherwani).
- ALLOWED: shirts, blazers, trousers, skirts, modest dresses, chinos.
- COLORS: navy, black, grey, beige, white, muted tones.
`;
    }

    const prompt = `
You are a professional stylist.

USER PROFILE:
- Gender: ${profile.gender || "unknown"}
- Height: ${profile.heightCm ?? "unknown"} cm
- Weight: ${profile.weightKg ?? "unknown"} kg
- Skin tone: ${profile.skinTone || "unknown"}
- Face/vibe: ${profile.facialFeatures || "unknown"}

OCCASION: "${occasion}"
${occasionRules}

WARDROBE (use these first):
${wardrobeList || "(empty)"}

Return ONLY JSON in this exact shape:
{
  "top":    { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "bottom": { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "shoes":  { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "accessory": { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "hairstyle":"", "hairstyleReasoning":"", "confidenceTip":"", "overallVibe":""
}
Do not include any commentary or markdown.
`;

    const contents = [{ role: "user", parts: [{ text: prompt }] }];

    const { text } = await callGeminiREST({ contents, generationConfig: { temperature: 0.25, maxOutputTokens: 700 } });

    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse outfit JSON", responseText: cleaned });
    }

    return res.json(parsed);
  } catch (err) {
    console.error("generate-outfit error:", err);
    return res.status(500).json({ error: err.message || "Outfit generation failed", detail: err.meta ?? null });
  }
});

// ---- OUTFIT IMAGE (IMAGEN) - supports 'sketch' and 'real' ----
app.post("/api/outfit-image", async (req, res) => {
  try {
    const { profile = {}, recommendation = {}, mode = "sketch" } = req.body || {};
    
    // Validate Input
    if (!profile.avatarImage) return res.status(400).json({ error: "profile.avatarImage required" });
    if (!PROJECT_ID) return res.status(500).json({ error: "PROJECT_ID not set for Imagen" });

    const avatarBase64 = profile.avatarImage.split(",")[1] || profile.avatarImage;

    // Build parts from recommendation
    const top = recommendation.top || {};
    const bottom = recommendation.bottom || {};
    const shoes = recommendation.shoes || {};
    const accessory = recommendation.accessory || {};

    // 1. Define Prompts
    // SKETCH PROMPT: Forces flat 2D illustration
    const sketchPrompt = `
      fashion illustration sketch of a person standing, 
      wearing ${top.color} ${top.name}, ${bottom.color} ${bottom.name}, ${shoes.color} ${shoes.name}.
      The person has ${profile.facialFeatures || "neutral expression"}.
      style: clean vector art, fashion croquis, pencil sketch, flat coloring, white background.
      high quality, masterpiece, full body view.
    `;

    // REAL PROMPT: Forces photorealism
    const realPrompt = `
      raw studio photo of a person standing,
      wearing ${top.color} ${top.name}, ${bottom.color} ${bottom.name}, ${shoes.color} ${shoes.name}.
      The person has ${profile.facialFeatures || "neutral expression"}.
      lighting: cinematic lighting, soft studio lights, 8k resolution, photorealistic, full body view.
    `;

    // 2. Define Negative Prompts (The Secret Sauce to fix your issues)
    // If we want a Sketch, we forbid "photorealism"
    const negSketch = "photorealistic, photograph, 3d render, camera, glossy, shadow, texture, noise, blurry, messy, watermark, text, extra limbs, distorted body, split body";
    // If we want Real, we forbid "drawings"
    const negReal = "drawing, sketch, cartoon, anime, painting, illustration, vector, 2d, black and white, blurry, low quality, extra limbs, distorted body, split body";

    const promptToUse = mode === "real" ? realPrompt : sketchPrompt;
    const negativeToUse = mode === "real" ? negReal : negSketch;

    const url = `https://${IMAGEN_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${IMAGEN_LOCATION}/publishers/google/models/${IMAGEN_MODEL}:predict`;
    const token = await getAccessToken();

    const body = {
      instances: [
        {
          prompt: promptToUse,
          referenceImages: [
            {
              referenceType: "REFERENCE_TYPE_RAW",
              referenceId: 1,
              referenceImage: { bytesBase64Encoded: avatarBase64 },
            },
          ],
        },
      ],
      parameters: {
        sampleCount: 1,
        // CRITICAL FIX: "3:4" matches your Frontend aspect-[3/4] perfectly.
        // This prevents the AI from squeezing the body (extra legs) or cropping the head.
        aspectRatio: "3:4", 
        negativePrompt: negativeToUse,
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
    if (!resp.ok) {
      console.error("Imagen predict failed", resp.status, json);
      return res.status(500).json({ error: "Imagen predict failed", detail: json });
    }

    const pred = json.predictions?.[0];
    if (!pred?.bytesBase64Encoded) {
      console.error("No bytes in Imagen response", json);
      return res.status(500).json({ error: "No image returned from Imagen", detail: json });
    }

    return res.json({ imageDataUrl: `data:image/png;base64,${pred.bytesBase64Encoded}` });
  } catch (err) {
    console.error("outfit-image error:", err);
    return res.status(500).json({ error: err.message || "Outfit image failed", detail: err.meta ?? null });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
