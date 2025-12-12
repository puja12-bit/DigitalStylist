// server.js - Gemini v1 REST backend + Imagen (improved prompts, safer parsing, model listing)
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
console.log("PORT=", PORT, "GEMINI_MODEL=", GEMINI_MODEL, "GEMINI_KEY_PRESENT=", !!GEMINI_API_KEY, "PROJECT_ID=", !!PROJECT_ID);

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
    // Safety: allow image analysis but don't auto-block useful content
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

  const json = await resp.json().catch(() => ({}));

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
  // Works only on GCP Cloud Run (metadata server)
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

// ---- Model listing helper (useful to confirm supported Gemini models for your key) ----
app.post("/api/list-models", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) return res.status(400).json({ error: "GEMINI_API_KEY missing" });
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (!resp.ok) return res.status(500).json({ error: "ListModels failed", detail: json });
    return res.json(json);
  } catch (err) {
    console.error("list-models error:", err);
    return res.status(500).json({ error: err.message || "List models failed" });
  }
});

// ---- PROFILE ANALYSIS ----
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    if (!base64Image || !mimeType) return res.status(400).json({ error: "base64Image and mimeType required" });

    const contentData = base64Image.split(",")[1] || base64Image;

    const prompt = `
Analyze the provided photo for a fashion styling application. Return EXACTLY JSON:
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
      generationConfig: { temperature: 0.05, maxOutputTokens: 300 },
    });

    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Return the raw response so you can debug in UI
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
      generationConfig: { temperature: 0.05, maxOutputTokens: 400 },
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

    const { text } = await callGeminiREST({ contents, generationConfig: { temperature: 0.2, maxOutputTokens: 700 } });

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

// ---- OUTFIT GENERATION ----
app.post("/api/generate-outfit", async (req, res) => {
  try {
    const { profile = {}, wardrobe = [], occasion = "" } = req.body || {};

    // Defensive normalization
    const rawOccasion = (occasion || "").trim();
    const wardrobeList = (wardrobe || [])
      .map((w) => `- ${w.color || "unknown"} ${w.name || "unknown"} (${w.category || "Other"})`)
      .join("\n");

    // If user provided nothing, force a generic occasion
    const occasionText = rawOccasion || "casual smart";

    // Instructions to force model to *derive* rules from any free-text occasion.
    // We also keep a few explicit templates for common cases for clarity.
    const prompt = `
You are an expert professional fashion stylist. You MUST follow the rules below precisely and return ONLY a single JSON object with the exact shape specified later.

INPUT SUMMARY:
- Profile: Gender: ${profile.gender || "unknown"}; Height: ${profile.heightCm ?? "unknown"} cm; Weight: ${profile.weightKg ?? "unknown"} kg; Skin tone: ${profile.skinTone || "unknown"}; Face/vibe: ${profile.facialFeatures || "unknown"}.
- OCCASION (free-text): "${occasionText}"
- WARDROBE (use these first where appropriate):
${wardrobeList || "(empty)"}

INSTRUCTIONS — READ CAREFULLY:
1. FIRST: Interpret the user's free-text OCCASION and create a short explicit RULES block (1-3 short bullet points) describing exactly what is required for that occasion (tone, formality, forbidden items, preferred colors/fabrics). If the occasion is ambiguous, assume "smart casual" unless user text suggests otherwise.
2. SECOND: Based on those RULES, produce the outfit JSON below. PRIORITIZE items from WARDROBE: if a WARDROBE item reasonably matches the required piece, set its source to "Wardrobe". If not available, recommend one shopping item and set source to "Shopping".
3. Keep all descriptions short (1-2 short sentences). Keep reasoning to one sentence explaining *why* the piece fits the occasion and the user.
4. Keep conservative styling for interviews; athletic for gym; festive for weddings; adapt to whatever the user text requests.
5. Use a low level of creativity: be practical and realistic.
6. Return ONLY the JSON object with these keys (no commentary, no extraneous fields):

JSON SCHEMA (exact keys):
{
  "top":    { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "bottom": { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "shoes":  { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "accessory": { "name":"", "description":"", "color":"", "source":"Wardrobe"|"Shopping", "reasoning":"" },
  "hairstyle":"", "hairstyleReasoning":"", "confidenceTip":"", "overallVibe":""
}

EXAMPLE:
{
  "top": { "name":"white shirt", "description":"Crisp white button-up shirt", "color":"white", "source":"Wardrobe", "reasoning":"Classic professional top that pairs with blazers." },
  "bottom": { "name":"navy trousers", "description":"Tailored navy trousers", "color":"navy", "source":"Shopping", "reasoning":"Neutral professional trousers to complete interview look." },
  "shoes": { "name":"black loafers", "description":"Simple leather loafers", "color":"black", "source":"Wardrobe", "reasoning":"Professional, comfortable formal shoes." },
  "accessory": { "name":"simple watch", "description":"Minimal leather-strap watch", "color":"brown", "source":"Shopping", "reasoning":"Adds polish without being flashy." },
  "hairstyle":"Neat low bun",
  "hairstyleReasoning":"Keeps hair tidy and professional.",
  "confidenceTip":"Stand straight and maintain eye contact.",
  "overallVibe":"Professional and dependable"
}

Now: produce the JSON only. Do NOT include any explanation or extra text.
`;

    const contents = [{ role: "user", parts: [{ text: prompt }] }];

    // Very low randomness for deterministic results; larger token limit
    const { text } = await callGeminiREST({ contents, generationConfig: { temperature: 0.05, maxOutputTokens: 900 } });

    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Return the raw text for debugging so you can see what the model returned
      return res.status(500).json({ error: "Failed to parse outfit JSON", responseText: cleaned });
    }

    // Sanity-check shape
    if (!parsed || typeof parsed !== "object" || !parsed.top || !parsed.shoes) {
      return res.status(500).json({ error: "Generated JSON missing required fields", responseText: cleaned });
    }

    return res.json(parsed);
  } catch (err) {
    console.error("generate-outfit error:", err);
    return res.status(500).json({ error: err.message || "Outfit generation failed", detail: err.meta ?? null });
  }
});


// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
