// server.js - REST Gemini v1 handlers (replace diagnostic file)
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use(express.static(path.join(__dirname, "dist")));

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash"; // change if needed

console.log("🚀 Server starting...");
console.log("PORT =", PORT);
console.log("NODE_ENV =", process.env.NODE_ENV);
console.log("GEMINI_API_KEY present =", !!GEMINI_API_KEY);
console.log("GEMINI_MODEL =", GEMINI_MODEL);

// --------- Helper: call Gemini v1 REST and return raw parsed text/JSON ----------
async function callGeminiREST({ model = GEMINI_MODEL, contents = [], generationConfig = {} }) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not set on server");
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;

  const body = {
    contents,
    generationConfig: {
      // allowed REST fields
      temperature: generationConfig.temperature ?? 0.4,
      topK: generationConfig.topK ?? 40,
      topP: generationConfig.topP ?? 0.95,
      maxOutputTokens: generationConfig.maxOutputTokens ?? 512,
    },
    // minimal safetySettings as strings (the REST accepts these simple values)
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
    // include full JSON for debugging
    const msg = `[Gemini REST ${resp.status}] ${JSON.stringify(json)}`;
    const err = new Error(msg);
    err.meta = json;
    throw err;
  }

  // Compose text from candidates -> content -> parts[].text
  const candidate = json?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join(" ").trim();

  if (!text) {
    throw new Error("Empty text response from Gemini");
  }

  return { text, raw: json };
}

// --------- ROUTES ----------

// health and static SPA fallback
app.get("/health", (_req, res) => res.status(200).send("OK"));
app.get("/", (_req, res) => res.send("Server running"));

// Analyze profile image -> returns { gender, heightCm, weightKg, skinTone, facialFeatures }
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    if (!base64Image || !mimeType) {
      return res.status(400).json({ error: "base64Image and mimeType are required" });
    }

    const contentData = base64Image.split(",")[1] || base64Image;

    const userPrompt = `
Analyze the provided photo for a fashion app. Return ONLY JSON with these fields:
{
  "gender": "Male|Female|Non-binary|uncertain",
  "heightCm": 170,
  "weightKg": 65,
  "skinTone": "Fair|Light|Medium|Olive|Tan|Dark|Deep",
  "facialFeatures": "One or two short sentences describing face shape, brows, nose, lips, eyes, hairstyle."
}
Keep facialFeatures concise (1-2 sentences). Do not add any extra text or commentary.
`;

    const contents = [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: contentData } },
          { text: userPrompt },
        ],
      },
    ];

    const { text } = await callGeminiREST({
      model: GEMINI_MODEL,
      contents,
      generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
    });

    // remove code fences and parse JSON
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // if parsing fails, return raw text for debugging
      return res.status(500).json({ error: "Failed to parse Gemini JSON response", responseText: cleaned });
    }

    // Normalize keys to your frontend shape if needed
    const respObj = {
      gender: parsed.gender ?? parsed.gender?.toLowerCase() ?? "uncertain",
      heightCm: parsed.heightCm ?? parsed.estimatedHeightCm ?? parsed.estimatedHeight ?? null,
      weightKg: parsed.weightKg ?? parsed.estimatedWeightKg ?? parsed.estimatedWeight ?? null,
      skinTone: parsed.skinTone ?? parsed.skin_tone ?? parsed.skin ?? null,
      facialFeatures: parsed.facialFeatures ?? parsed.facial_features ?? parsed.facial_description ?? "",
    };

    return res.json(respObj);
  } catch (err) {
    console.error("analyze-profile-image error:", err);
    return res.status(500).json({ error: err.message || "Profile analysis failed", detail: err.meta ?? null });
  }
});

// Generate outfit -> returns the JSON outfit object as described in prompts
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
- FORBIDDEN: shiny fabrics, sequin, heavy festive/wedding outfits (kurta pajama, lehenga, sherwani).
- ALLOWED: shirts, blazers, trousers, pencil skirts, modest dresses, chinos.
- COLORS: navy, black, grey, beige, white, muted tones.
`;
    }

    const prompt = `
You are a professional fashion stylist. Based on the USER PROFILE and WARDROBE below, produce a single outfit that fits the occasion.

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
Do not include any commentary or markdown. Keep strings concise but specific.
`;

    const contents = [{ role: "user", parts: [{ text: prompt }] }];

    const { text } = await callGeminiREST({
      model: GEMINI_MODEL,
      contents,
      generationConfig: { temperature: 0.25, maxOutputTokens: 700 },
    });

    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse outfit JSON from Gemini", responseText: cleaned });
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

// start server
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
