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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ---- basic middleware ----
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// ---- static frontend from dist ----
app.use(express.static(path.join(__dirname, "dist")));

// ---- Gemini client ----
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not set – all API routes will fail.");
}
const genAI = new GoogleGenerativeAI(apiKey || "");

// shared safety settings
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

const cleanJSON = (text) => text.replace(/```json\s*|\s*```/g, "").trim();

// ------------------------------------------------------------------
// 1) Analyze profile photo
// ------------------------------------------------------------------
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });
    const { base64Image, mimeType } = req.body;
    if (!base64Image || !mimeType) {
      return res.status(400).json({ error: "base64Image and mimeType required" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
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

    const prompt =
      "You are a styling assistant. Analyze this person's appearance ONLY from the photo. " +
      "Estimate ALL of: gender (Male/Female/Non-Binary), estimatedHeightCm (number), estimatedWeightKg (number), " +
      "skinTone (Fair, Light, Medium, Olive, Tan, Dark, Deep), and facialFeatures (short description). " +
      "Always return valid JSON matching the schema, never 'unknown'.";

    const base64Content = base64Image.split(",")[1] || base64Image;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Content,
                mimeType
              }
            },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = result.response.text();
    const data = JSON.parse(cleanJSON(text));

    res.json({
      gender: data.gender,
      heightCm: data.estimatedHeightCm,
      weightKg: data.estimatedWeightKg,
      skinTone: data.skinTone,
      facialFeatures: data.facialFeatures
    });
  } catch (err) {
    console.error("analyze-profile-image error:", err);
    res.status(500).json({ error: "Failed to analyze profile image" });
  }
});

// ------------------------------------------------------------------
// 2) Analyze wardrobe photo
// ------------------------------------------------------------------
app.post("/api/analyze-wardrobe-image", async (req, res) => {
  try {
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });
    const { base64Image, mimeType } = req.body;
    if (!base64Image || !mimeType) {
      return res.status(400).json({ error: "base64Image and mimeType required" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
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

    const prompt =
      "Identify all clothing items in this image for a wardrobe manager. " +
      "For each item, return name, category, and color. " +
      "Return ONLY JSON array.";

    const base64Content = base64Image.split(",")[1] || base64Image;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Content,
                mimeType
              }
            },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = result.response.text();
    const items = JSON.parse(cleanJSON(text));

    const mapped = items.map((item) => ({
      id: Math.random().toString(36).substring(2, 9),
      ...item
    }));

    res.json(mapped);
  } catch (err) {
    console.error("analyze-wardrobe-image error:", err);
    res.status(500).json({ error: "Failed to analyze wardrobe image" });
  }
});

// ------------------------------------------------------------------
// 3) Generate outfit (text)
// ------------------------------------------------------------------
app.post("/api/generate-outfit", async (req, res) => {
  try {
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

    const { profile, wardrobe, occasion } = req.body;
    if (!profile || !wardrobe || !occasion) {
      return res.status(400).json({ error: "profile, wardrobe, occasion required" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
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
        overallVibe: { type: SchemaType.STRING }
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
      User Profile: ${profile.gender}, ${profile.heightCm}cm, ${profile.weightKg}kg, ${profile.skinTone}, ${profile.facialFeatures}
      Occasion: "${occasion}"
      Wardrobe:
      ${wardrobeList}

      Goal: Create an outfit. Prioritize wardrobe items first; only suggest "Shopping" when something critical is missing.
      Return ONLY JSON matching the schema.
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const text = result.response.text();
    const outfit = JSON.parse(cleanJSON(text));

    res.json(outfit);
  } catch (err) {
    console.error("generate-outfit error:", err);
    res.status(500).json({ error: "Failed to generate outfit" });
  }
});

// ------------------------------------------------------------------
// 4) Generate outfit image (fashion sketch / real look)
// ------------------------------------------------------------------
app.post("/api/outfit-image", async (req, res) => {
  try {
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

    const { profile, recommendation, mode } = req.body;
    if (!profile?.avatarImage || !recommendation || !mode) {
      return res
        .status(400)
        .json({ error: "profile.avatarImage, recommendation, mode required" });
    }

    const avatarBase64 =
      profile.avatarImage.split(",")[1] || profile.avatarImage;
    const avatarMime =
      profile.avatarImage.includes("image/png") ? "image/png" : "image/jpeg";

    const outfitDescription = [
      recommendation.top &&
        `${recommendation.top.color} ${recommendation.top.name}`,
      recommendation.bottom &&
        `${recommendation.bottom.color} ${recommendation.bottom.name}`,
      recommendation.shoes &&
        `${recommendation.shoes.color} ${recommendation.shoes.name}`,
      recommendation.accessory &&
        `${recommendation.accessory.color} ${recommendation.accessory.name}`
    ]
      .filter(Boolean)
      .join(", ");

    const styleText =
      mode === "FASHION_SKETCH"
        ? "as a clean digital fashion sketch / editorial illustration, minimal background"
        : "as a photorealistic full-body portrait, studio lighting, simple background";

    const prompt = `
      You are a virtual stylist renderer.
      Take this person's photo and redraw them wearing this outfit: ${outfitDescription}.
      Preserve their identity, face and body shape.
      Show at least from head to knees.
      Render ${styleText}.
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: avatarBase64,
                mimeType: avatarMime
              }
            },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "image/png"
      }
    });

    const response = result.response;
    const candidate = response?.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    const inline = part?.inlineData;

    if (!inline?.data || !inline?.mimeType) {
      console.error("No inlineData in image response", response);
      return res.status(500).json({ error: "No image returned from Gemini" });
    }

    const imageDataUrl = `data:${inline.mimeType};base64,${inline.data}`;
    res.json({ imageDataUrl });
  } catch (err) {
    console.error("outfit-image error:", err);
    res.status(500).json({ error: "Failed to generate outfit image" });
  }
});

// ------------------------------------------------------------------
// SPA fallback – return index.html for everything else
// ------------------------------------------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
});
