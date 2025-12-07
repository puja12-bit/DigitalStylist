// =====================================================================
// FULL SERVER.JS — DIGITAL STYLIST AI
// USER PHOTO → IMAGEN EDIT → SKETCH + REAL LOOK
// GEMINI → PROFILE + WARDROBE + OUTFIT
// STRICT OCCASION RULES (INTERVIEW, OFFICE, PARTY, WEDDING)
// =====================================================================

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

// ------------------------------------------------------------
// BASICS
// ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use(express.static(path.join(__dirname, "dist")));

const PORT = process.env.PORT || 8080;

// ------------------------------------------------------------
// GEMINI (TEXT)
// ------------------------------------------------------------
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) console.warn("⚠ GEMINI_API_KEY missing");

const genAI = new GoogleGenerativeAI(GEMINI_KEY || "");

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

const cleanJSON = (txt) => txt.replace(/```json|```/g, "").trim();

// ------------------------------------------------------------
// IMAGEN EDIT CONFIG
// ------------------------------------------------------------
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "digitalstylist";
const IMAGEN_LOCATION = "us-central1";

// This is the EDIT CAPABILITY MODEL — required for user-photo editing
const IMAGEN_MODEL = "imagen-3.0-capability-001";

// Fetch Cloud Run token
async function getAccessToken() {
  const res = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } }
  );

  if (!res.ok) throw new Error("Failed to fetch identity token");

  const json = await res.json();
  return json.access_token;
}

// =======================================================================
// 1) PROFILE ANALYSIS (GEMINI)
// =======================================================================
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
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

    const content = base64Image.split(",")[1] || base64Image;

    const prompt = `
Analyze this person's physical appearance.
Return JSON with:
- gender
- estimatedHeightCm
- estimatedWeightKg
- skinTone
- facialFeatures
`;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: content, mimeType } },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const parsed = JSON.parse(cleanJSON(result.response.text()));

    res.json({
      gender: parsed.gender,
      heightCm: parsed.estimatedHeightCm,
      weightKg: parsed.estimatedWeightKg,
      skinTone: parsed.skinTone,
      facialFeatures: parsed.facialFeatures
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =======================================================================
// 2) WARDROBE ANALYSIS (GEMINI)
// =======================================================================
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

    const content = base64Image.split(",")[1] || base64Image;

    const prompt = `
Identify each clothing item.
Return JSON: [{ name, category, color }]
`;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: content, mimeType } },
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
      items.map((x) => ({ id: Math.random().toString(36).slice(2), ...x }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =======================================================================
// 3) OUTFIT GENERATION (GEMINI) — STRONG OCCASION RULES
// =======================================================================
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

    // Convert wardrobe array
    const wardrobeList = (wardrobe || [])
      .map((w) => `- ${w.color} ${w.name} (${w.category})`)
      .join("\n");

    const o = (occasion || "").toLowerCase();
    let occasionRules = "General smart-casual outfit.";

    if (o.includes("interview")) {
      occasionRules = `
INTERVIEW RULES:
- NO shiny clothing
- NO ethnic-wear sets (kurta pajama, sherwani, lehenga)
- MUST be professional: shirts, blouses, blazers, trousers, pencil skirts
- Colors: navy, black, grey, beige, white
- Shoes: formal closed-toe
`;
    } else if (o.includes("office") || o.includes("work")) {
      occasionRules = `
OFFICE RULES:
- Smart but comfortable
- NO wedding-level shine or sequins
- Simple kurtas OK only if minimal and elegant
`;
    } else if (o.includes("party") || o.includes("wedding") || o.includes("festive")) {
      occasionRules = `
FESTIVE RULES:
- Ethnic wear allowed
- Color, shine OK
`;
    }

    const prompt = `
You are a professional stylist.

PROFILE:
${profile.gender}, ${profile.heightCm}cm, ${profile.weightKg}kg
Skin tone: ${profile.skinTone}
Face: ${profile.facialFeatures}

OCCASION: "${occasion}"
${occasionRules}

WARDROBE:
${wardrobeList || "(no wardrobe)"}

HARD RULES:
1. Outfit MUST match occasion rules.
2. Use wardrobe first, only use Shopping when necessary.
3. NO non-occasion-appropriate items.
4. RETURN ONLY JSON (exact schema).
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema }
    });

    const parsed = JSON.parse(cleanJSON(result.response.text()));
    parsed.occasion = occasion;

    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =======================================================================
// 4) IMAGEN EDIT — USER PHOTO → SKETCH + REAL LOOK
// =======================================================================
app.post("/api/outfit-image", async (req, res) => {
  try {
    const { profile, recommendation, mode } = req.body;

    if (!profile?.avatarImage)
      return res.status(400).json({ error: "Missing profile.avatarImage" });

    if (mode !== "sketch" && mode !== "real")
      return res.status(400).json({ error: "Mode must be sketch or real" });

    const avatarBase64 =
      profile.avatarImage.split(",")[1] || profile.avatarImage;

    const editPrompt = `
Change ONLY the clothing on this person.

OUTFIT:
Top: ${recommendation.top.color} ${recommendation.top.name}
Bottom: ${recommendation.bottom.color} ${recommendation.bottom.name}
Shoes: ${recommendation.shoes.color} ${recommendation.shoes.name}
Accessory: ${recommendation.accessory.name}

RULES:
- KEEP face, body, pose, lighting, background EXACTLY SAME.
- Only change clothing.
`;

    const stylePrompt =
      mode === "sketch"
        ? "Render as high-end fashion illustration, white background."
        : "Render photorealistic, studio quality.";

    const finalPrompt = `${editPrompt}\n\nStyle: ${stylePrompt}`;

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
              referenceImage: { bytesBase64Encoded: avatarBase64 }
            }
          ]
        }
      ],
      parameters: {
        sampleCount: 1,
        personGeneration: "allow_adult",
        outputOptions: { mimeType: "image/png" }
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

    if (!resp.ok) return res.status(500).json({ error: json });

    const pred = json.predictions?.[0];
    if (!pred?.bytesBase64Encoded)
      return res.status(500).json({ error: "No image returned" });

    res.json({
      imageDataUrl: `data:image/png;base64,${pred.bytesBase64Encoded}`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =======================================================================
// FRONTEND FALLBACK
// =======================================================================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// =======================================================================
// START SERVER
// =======================================================================
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
