import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  SchemaType,
} from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use(express.static(path.join(__dirname, "dist")));

const PORT = process.env.PORT || 8080;

// ---- GEMINI CONFIG (STABLE) ----
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn("⚠ GEMINI_API_KEY is not set. Gemini calls will fail.");
}
const GEMINI_MODEL = "gemini-1.5-flash";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const cleanJSON = (txt) => txt.replace(/```json|```/g, "").trim();

// ---------- 1) PROFILE ANALYSIS ----------
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    if (!base64Image || !mimeType) {
      return res
        .status(400)
        .json({ error: "base64Image and mimeType are required" });
    }

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      safetySettings,
    });

    const content = base64Image.split(",")[1] || base64Image;

    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        gender: { type: SchemaType.STRING },
        estimatedHeightCm: { type: SchemaType.NUMBER },
        estimatedWeightKg: { type: SchemaType.NUMBER },
        skinTone: { type: SchemaType.STRING },
        facialFeatures: { type: SchemaType.STRING },
      },
      required: [
        "gender",
        "estimatedHeightCm",
        "estimatedWeightKg",
        "skinTone",
        "facialFeatures",
      ],
    };

    const prompt = `
You are analyzing a human's physical appearance for a fashion styling application.
Return JSON with:
- gender
- estimatedHeightCm
- estimatedWeightKg
- skinTone
- facialFeatures (1–2 sentences describing face and vibe)
`;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: content, mimeType } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const parsed = JSON.parse(cleanJSON(result.response.text()));

    return res.json({
      gender: parsed.gender,
      heightCm: parsed.estimatedHeightCm,
      weightKg: parsed.estimatedWeightKg,
      skinTone: parsed.skinTone,
      facialFeatures: parsed.facialFeatures,
    });
  } catch (e) {
    console.error("analyze-profile-image error:", e);
    return res
      .status(500)
      .json({ error: e?.message || "Profile analysis failed" });
  }
});

// ---------- 2) WARDROBE ANALYSIS ----------
app.post("/api/analyze-wardrobe-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    if (!base64Image || !mimeType) {
      return res
        .status(400)
        .json({ error: "base64Image and mimeType are required" });
    }

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      safetySettings,
    });

    const content = base64Image.split(",")[1] || base64Image;

    const schema = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          color: { type: SchemaType.STRING },
        },
        required: ["name", "category", "color"],
      },
    };

    const prompt = `
Identify each clothing item in this image.
Return ONLY JSON array:
[
  { "name": "...", "category": "...", "color": "..." }
]
`;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: content, mimeType } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const items = JSON.parse(cleanJSON(result.response.text()));

    res.json(
      items.map((x) => ({
        id: Math.random().toString(36).slice(2),
        ...x,
      }))
    );
  } catch (e) {
    console.error("analyze-wardrobe-image error:", e);
    res.status(500).json({ error: e?.message || "Wardrobe analysis failed" });
  }
});

// ---------- 3) OUTFIT GENERATION ----------
app.post("/api/generate-outfit", async (req, res) => {
  try {
    const { profile, wardrobe, occasion } = req.body || {};

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      safetySettings,
    });

    const itemSchema = {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        color: { type: SchemaType.STRING },
        source: { type: SchemaType.STRING, enum: ["Wardrobe", "Shopping"] },
        reasoning: { type: SchemaType.STRING },
      },
      required: ["name", "description", "color", "source", "reasoning"],
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
        occasion: { type: SchemaType.STRING },
      },
      required: [
        "top",
        "bottom",
        "shoes",
        "accessory",
        "hairstyle",
        "hairstyleReasoning",
        "confidenceTip",
        "overallVibe",
      ],
    };

    const wardrobeList = (wardrobe || [])
      .map((w) => `- ${w.color} ${w.name} (${w.category})`)
      .join("\n");

    const o = (occasion || "").toLowerCase();
    let occasionRules = "General smart-casual outfit.";

    if (o.includes("interview")) {
      occasionRules = `
OCCASION CATEGORY: JOB INTERVIEW
RULES:
- MUST look professional, serious, and reliable.
- FORBIDDEN: shiny fabrics, sequins, glitter, heavy embroidery, wedding-style ethnic sets.
- FORBIDDEN: kurta pajama, sherwani, lehenga, anarkali.
- ALLOWED: shirts, blouses, blazers, trousers, chinos, pencil skirts, sheath dresses.
- COLORS: navy, black, grey, beige, white, muted tones.
`;
    }

    const prompt = `
You are a professional stylist.

USER PROFILE:
- Gender: ${profile?.gender || "unknown"}
- Height: ${profile?.heightCm || "unknown"} cm
- Weight: ${profile?.weightKg || "unknown"} kg
- Skin tone: ${profile?.skinTone || "unknown"}
- Face / vibe: ${profile?.facialFeatures || "unknown"}

OCCASION: "${occasion}"

${occasionRules}

WARDROBE (USE THESE FIRST):
${wardrobeList || "(empty wardrobe — may need Shopping items)"}

HARD RULES:
1. Outfit must fit the occasion.
2. Use wardrobe items before Shopping.
3. Colors/descriptions must be consistent.
4. Return ONLY valid JSON according to schema.
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const parsed = JSON.parse(cleanJSON(result.response.text()));
    parsed.occasion = occasion;

    res.json(parsed);
  } catch (e) {
    console.error("generate-outfit error:", e);
    res.status(500).json({ error: e?.message || "Outfit generation failed" });
  }
});

// ---------- SPA FALLBACK ----------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
