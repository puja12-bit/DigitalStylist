// -------------------------
// FULL SERVER.JS FOR CLOUD RUN
// USER-PHOTO-BASED OUTFIT IMAGES
// -------------------------

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  SchemaType
} from "@google/generative-ai";

// -------------------------------------------------------------------------
// BASICS
// -------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "30mb" }));

// serve frontend
app.use(express.static(path.join(__dirname, "dist")));

// -------------------------------------------------------------------------
// GEMINI TEXT CLIENT
// -------------------------------------------------------------------------
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is missing");
}
const genAI = new GoogleGenerativeAI(GEMINI_KEY || "");

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

const cleanJSON = (t) => t.replace(/```json\s*|\s*```/g, "").trim();

// -------------------------------------------------------------------------
// VERTEX IMAGEN CONFIG
// -------------------------------------------------------------------------
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "digitalstylist";
const IMAGEN_LOCATION = "us-central1";
const IMAGEN_MODEL = "imagen-3.0-capability-001";

// Get Cloud Run identity token
async function getAccessToken() {
  const res = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: { "Metadata-Flavor": "Google" }
    }
  );

  if (!res.ok) throw new Error("Failed to fetch metadata token");
  const json = await res.json();
  return json.access_token;
}

// -------------------------------------------------------------------------
// API 1 — Profile Analysis (Gemini)
// -------------------------------------------------------------------------
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY missing");
    const { base64Image, mimeType } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings
    });

    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        gender: { type: SchemaType.STRING },
        estimatedHeightCm: { type: SchemaType.NUMBER },
        estimatedWeightKg: { type: SchemaType.NUMBER },
        skinTone: { type: SchemaType.STRING },
        facialFeatures: { type: SchemaType.STRING }
      },
      required: [
        "gender",
        "estimatedHeightCm",
        "estimatedWeightKg",
        "skinTone",
        "facialFeatures"
      ]
    };

    const base64Content = base64Image.split(",")[1] || base64Image;

    const prompt = `
Analyze this person's appearance ONLY.
Return JSON with:
- gender
- estimatedHeightCm
- estimatedWeightKg
- skinTone
- facialFeatures
`;

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Content, mimeType } },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const parsed = JSON.parse(cleanJSON(response.response.text()));

    res.json({
      gender: parsed.gender,
      heightCm: parsed.estimatedHeightCm,
      weightKg: parsed.estimatedWeightKg,
      skinTone: parsed.skinTone,
      facialFeatures: parsed.facialFeatures
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------------
// API 2 — Wardrobe Analysis (Gemini)
// -------------------------------------------------------------------------
app.post("/api/analyze-wardrobe-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings
    });

    const schema = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          color: { type: SchemaType.STRING }
        },
        required: ["name", "category", "color"]
      }
    };

    const base64Content = base64Image.split(",")[1] || base64Image;

    const prompt = `
Identify clothing items. Return JSON array:
[{ name, category, color }]
`;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Content, mimeType } },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const items = JSON.parse(cleanJSON(result.response.text()));

    res.json(
      items.map((x) => ({
        id: Math.random().toString(36).substring(2),
        ...x
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------------
// API 3 — Outfit Generation (Gemini)
// -------------------------------------------------------------------------
app.post("/api/generate-outfit", async (req, res) => {
  try {
    const { profile, wardrobe, occasion } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings
    });

    const itemSchema = {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        color: { type: SchemaType.STRING },
        source: { type: SchemaType.STRING, enum: ["Wardrobe", "Shopping"] },
        reasoning: { type: SchemaType.STRING }
      },
      required: ["name", "description", "color", "source", "reasoning"]
    };

    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        top: itemSchema,
        bottom: itemSchema,
        shoes: itemSchema,
        accessory: itemSchema,
        hairstyle: { type: SchemaType.STRING },
        hairstyleReasoning: { type: SchemaType.STRING },
        confidenceTip: { type: SchemaType.STRING },
        overallVibe: { type: SchemaType.STRING },
        occasion: { type: SchemaType.STRING }
      },
      required: [
        "top",
        "bottom",
        "shoes",
        "accessory",
        "hairstyle",
        "hairstyleReasoning",
        "confidenceTip",
        "overallVibe"
      ]
    };

    const wardrobeList = wardrobe
      .map((w) => `- ${w.color} ${w.name} (${w.category})`)
      .join("\n");

    const prompt = `
You are a professional stylist.

PROFILE
${profile.gender}, ${profile.heightCm}cm, ${profile.weightKg}kg
Skin tone: ${profile.skinTone}
Face: ${profile.facialFeatures}

OCCASION:
"${occasion}"

WARDROBE (use these first):
${wardrobeList}

RULES:
1. Outfit MUST match the occasion
2. Use wardrobe first
3. Only use "Shopping" when needed
4. Return ONLY JSON matching schema
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const parsed = JSON.parse(cleanJSON(result.response.text()));
    parsed.occasion = occasion;

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------------
// API 4 — FASHION SKETCH + REAL LOOK (Imagen Edit)
// THIS USES USER’S PHOTO 100%
// -------------------------------------------------------------------------
app.post("/api/outfit-image", async (req, res) => {
  try {
    const { profile, recommendation, mode } = req.body;

    if (!profile?.avatarImage) {
      return res.status(400).json({ error: "profile.avatarImage missing" });
    }

    const base64Avatar =
      profile.avatarImage.split(",")[1] || profile.avatarImage;

    const outfitPrompt = `
Edit this person so they are wearing:

TOP: ${recommendation.top?.color} ${recommendation.top?.name}
BOTTOM: ${recommendation.bottom?.color} ${recommendation.bottom?.name}
SHOES: ${recommendation.shoes?.color} ${recommendation.shoes?.name}
ACCESSORY: ${recommendation.accessory?.name}

Keep same:
- face
- body shape
- pose
- lighting
- background

Only change clothing.
`.trim();

    const stylePrompt =
      mode === "sketch"
        ? "Render as a clean fashion illustration, white background, soft lines."
        : "Render photorealistic, studio lighting.";

    const finalPrompt = `${outfitPrompt}\n\nStyle: ${stylePrompt}`;

    const url = `https://${IMAGEN_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${IMAGEN_LOCATION}/publishers/google/models/${IMAGEN_MODEL}:predict`;

    const token = await getAccessToken();

    const body = {
      instances: [
        {
          prompt: finalPrompt,
          referenceImages: [
            {
              referenceType: "REFERENCE_TYPE_RAW",
              referenceId: 1,
              referenceImage: { bytesBase64Encoded: base64Avatar }
            }
          ]
        }
      ],
      parameters: {
        sampleCount: 1,
        outputOptions: { mimeType: "image/png" },
        personGeneration: "allow_adult"
      }
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const json = await resp.json();

    if (!resp.ok) {
      return res.status(500).json({ error: json });
    }

    const pred = json.predictions?.[0];
    if (!pred?.bytesBase64Encoded) {
      return res.status(500).json({ error: "No image returned" });
    }

    res.json({
      imageDataUrl: `data:image/png;base64,${pred.bytesBase64Encoded}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------------
// SPA fallback
// -------------------------------------------------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on", PORT));
