// server.js - resilient backend for DigitalStylist (Gemini + Imagen with safe fallback)
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
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || "";
const IMAGEN_LOCATION = process.env.IMAGEN_LOCATION || "us-central1";
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || "imagen-3.0-capability-001";

// Placeholder images (ensure these files exist in dist/assets/)
const PLACEHOLDER_SKETCH = "/assets/placeholder_sketch.png";
const PLACEHOLDER_REAL = "/assets/placeholder_real.png";

console.log("Server starting...");
console.log("PORT=", PORT, "GEMINI_MODEL=", GEMINI_MODEL, "GEMINI_KEY_PRESENT=", !!GEMINI_API_KEY, "PROJECT_ID=", !!PROJECT_ID);

// ================= Helper: call Gemini v1 REST =================
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

// ================= Helper: get GCP access token from metadata server =================
async function getAccessToken() {
  // Works only on GCP (Cloud Run). If it fails, we surface the error for debugging.
  const resp = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: { "Metadata-Flavor": "Google" },
    }
  );
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    throw new Error(`Failed to fetch metadata token: ${resp.status} ${txt}`);
  }
  const j = await resp.json();
  return j.access_token;
}

// ================= Routes =================
app.get("/health", (_req, res) => res.status(200).send("OK"));

// PROFILE / WARDROBE / GENERATE routes: copy of your working ones (not modified here)
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    if (!base64Image || !mimeType) return res.status(400).json({ error: "base64Image and mimeType required" });

    const contentData = base64Image.split(",")[1] || base64Image;
    const prompt = `
Analyze the provided photo for a fashion styling application. Return EXACTLY a JSON object with:
{ "gender":"Male|Female|Non-binary|uncertain", "heightCm":170, "weightKg":65, "skinTone":"Fair|Light|Medium|Olive|Tan|Dark|Deep", "facialFeatures":"One or two short sentences." }
Return only JSON.
`;

    const contents = [
      { role: "user", parts: [{ inline_data: { mime_type: mimeType, data: contentData } }, { text: prompt }] },
    ];

    const { text } = await callGeminiREST({ contents, generationConfig: { temperature: 0.1, maxOutputTokens: 300 } });

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
      { role: "user", parts: [{ inline_data: { mime_type: mimeType, data: contentData } }, { text: prompt }] },
    ];

    const { text } = await callGeminiREST({ contents, generationConfig: { temperature: 0.1, maxOutputTokens: 400 } });
    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("Gemini did not return an array");
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse wardrobe JSON", responseText: cleaned });
    }

    const items = parsed.map((it) => ({ id: Math.random().toString(36).substr(2, 9), name: it.name || it.item || "Unknown item", category: it.category || "Other", color: it.color || it.colour || "Unknown" }));
    return res.json(items);
  } catch (err) {
    console.error("analyze-wardrobe-image error:", err);
    return res.status(500).json({ error: err.message || "Wardrobe analysis failed", detail: err.meta ?? null });
  }
});

// GENERATE OUTFIT (keep defensive)
app.post("/api/generate-outfit", async (req, res) => {
  try {
    const { profile = {}, wardrobe = [], occasion = "" } = req.body || {};
    const wardrobeList = (wardrobe || []).map((w) => `- ${w.color || "unknown"} ${w.name || "unknown"} (${w.category || "Other"})`).join("\n");
    const o = (occasion || "").trim() || "casual smart";

    const prompt = `
You are an expert fashion stylist. Return ONLY JSON in this exact shape:
{
  "top": { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "bottom": { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "shoes": { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "accessory": { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "hairstyle":"", "hairstyleReasoning":"", "confidenceTip":"", "overallVibe":""
}
Be concise and practical. Use WARDROBE items when possible.
OCCASION: "${o}"
WARDROBE:
${wardrobeList || "(empty)"}
`;

    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const { text } = await callGeminiREST({ contents, generationConfig: { temperature: 0.05, maxOutputTokens: 700 } });
    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse outfit JSON", responseText: cleaned });
    }
    // attach occasion (frontend expects an 'occasion' property sometimes)
    if (!parsed.occasion) parsed.occasion = o;
    return res.json(parsed);
  } catch (err) {
    console.error("generate-outfit error:", err);
    return res.status(500).json({ error: err.message || "Outfit generation failed", detail: err.meta ?? null });
  }
});

// ============ OUTFIT IMAGE (Imagen) with robust fallback ============
app.post("/api/outfit-image", async (req, res) => {
  try {
    const { profile = {}, recommendation = {}, mode = "sketch" } = req.body || {};
    if (!profile.avatarImage) return res.status(400).json({ error: "profile.avatarImage required" });

    // Quick fail-safe: if PROJECT_ID missing, return placeholder so UI isn't broken
    if (!PROJECT_ID) {
      console.warn("PROJECT_ID not set: returning placeholder image");
      const fallback = mode === "real" ? PLACEHOLDER_REAL : PLACEHOLDER_SKETCH;
      return res.json({ imageDataUrl: fallback });
    }

    const avatarBase64 = profile.avatarImage.split(",")[1] || profile.avatarImage;
    const top = recommendation.top || {};
    const bottom = recommendation.bottom || {};
    const shoes = recommendation.shoes || {};
    const accessory = recommendation.accessory || {};

    // Prompts
    const sketchPrompt = `
fashion illustration sketch of a person standing, wearing ${top.color || ""} ${top.name || ""}, ${bottom.color || ""} ${bottom.name || ""}, ${shoes.color || ""} ${shoes.name || ""}.
The person should be a neutral standing pose, face preserved, no extra limbs, clean pencil sketch style, white background, full body view.
`;
    const realPrompt = `
studio photo of a person standing, wearing ${top.color || ""} ${top.name || ""}, ${bottom.color || ""} ${bottom.name || ""}, ${shoes.color || ""} ${shoes.name || ""}.
Photorealistic, neutral standing pose, preserve identity and face, full body, soft cinematic lighting, 4k.
`;
    const negSketch = "photorealistic, photograph, 3d render, extra limbs, extra fingers, warped body, text, watermark";
    const negReal = "drawing, sketch, cartoon, anime, extra limbs, distorted, low quality";

    const promptToUse = mode === "real" ? realPrompt : sketchPrompt;
    const negativeToUse = mode === "real" ? negReal : negSketch;

    const url = `https://${IMAGEN_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${IMAGEN_LOCATION}/publishers/google/models/${IMAGEN_MODEL}:predict`;

    // get token
    let token;
    try {
      token = await getAccessToken();
    } catch (err) {
      console.error("Failed to get access token from metadata:", err);
      // fallback: return placeholder so UI shows something
      const fallback = mode === "real" ? PLACEHOLDER_REAL : PLACEHOLDER_SKETCH;
      return res.json({ imageDataUrl: fallback, warning: "Token fetch failed, returned placeholder. Check service account permissions and metadata." });
    }

    const body = {
      instances: [
        {
          prompt: promptToUse,
          referenceImages: [{ referenceType: "REFERENCE_TYPE_RAW", referenceId: 1, referenceImage: { bytesBase64Encoded: avatarBase64 } }],
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "3:4",
        negativePrompt: negativeToUse,
        personGeneration: "allow_adult",
        outputOptions: { mimeType: "image/png" },
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await resp.json().catch(() => ({ error: "invalid-json-response" }));
    if (!resp.ok) {
      console.error("Imagen predict failed:", resp.status, JSON.stringify(json));
      // Return placeholder but include detail for debugging
      const fallback = mode === "real" ? PLACEHOLDER_REAL : PLACEHOLDER_SKETCH;
      return res.status(500).json({ error: "Imagen predict failed", detail: json, imageDataUrl: fallback });
    }

    const pred = json.predictions?.[0];
    if (!pred?.bytesBase64Encoded) {
      console.error("No image bytes returned:", JSON.stringify(json));
      const fallback = mode === "real" ? PLACEHOLDER_REAL : PLACEHOLDER_SKETCH;
      return res.status(500).json({ error: "No image returned from Imagen", detail: json, imageDataUrl: fallback });
    }

    return res.json({ imageDataUrl: `data:image/png;base64,${pred.bytesBase64Encoded}` });
  } catch (err) {
    console.error("outfit-image error:", err);
    // final fallback: serve placeholder image path (so frontend shows it)
    const fallback = req.body?.mode === "real" ? PLACEHOLDER_REAL : PLACEHOLDER_SKETCH;
    return res.status(500).json({ error: err.message || "Outfit image failed", detail: err.meta ?? null, imageDataUrl: fallback });
  }
});

// Diagnostic endpoint to test metadata/token access
app.get("/diag/imagen", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ ok: true, tokenStartsWith: token?.slice?.(0, 8) ?? null, projectId: PROJECT_ID });
  } catch (err) {
    console.error("diag/imagen error:", err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
