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

// ---------- BASIC MIDDLEWARE ----------
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// ---------- STATIC FRONTEND ----------
app.use(express.static(path.join(__dirname, "dist")));

// ---------- GEMINI CLIENT (TEXT JSON) ----------
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not set – Gemini text routes will fail.");
}
const genAI = new GoogleGenerativeAI(apiKey || "");

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

const cleanJSON = (text) => text.replace(/```json\s*|\s*```/g, "").trim();

// ---------- VERTEX IMAGEN CONFIG ----------
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "digitalstylist";
const IMAGEN_LOCATION = process.env.IMAGEN_LOCATION || "us-central1";
const IMAGEN_MODEL = "imagen-3.0-fast-generate-001";

// Cloud Run has metadata server for access tokens
async function getAccessToken() {
  const res = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: { "Metadata-Flavor": "Google" }
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Metadata token error ${res.status}: ${text || res.statusText}`
    );
  }
  const json = await res.json();
  if (!json.access_token) throw new Error("No access_token from metadata");
  return json.access_token;
}

// ======================================================
// 1) PROFILE ANALYSIS FROM IMAGE  (Gemini text JSON)
// ======================================================
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    if (!apiKey) throw new Error("GEMINI_API_KEY not set on server");
    const { base64Image, mimeType } = req.body;
    if (!base64Image || !mimeType) {
      return res.status(400).json({ error: "base64Image and mimeType required" });
    }

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

    const prompt =
      "You are a styling assistant. Analyze this person's appearance ONLY from the photo. " +
      "Estimate gender, estimatedHeightCm (number), estimatedWeightKg (number), " +
      "skinTone (Fair, Light, Medium, Olive, Tan, Dark, Deep), and facialFeatures (short description). " +
      "Always return valid JSON matching the schema.";

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
    res.status(500).json({
      error: err?.message || "Failed to analyze profile image"
    });
  }
});

// ======================================================
// 2) WARDROBE ANALYSIS FROM IMAGE (Gemini JSON)
// ======================================================
app.post("/api/analyze-wardrobe-image", async (req, res) => {
  try {
    if (!apiKey) throw new Error("GEMINI_API_KEY not set on server");
    const { base64Image, mimeType } = req.body;
    if (!base64Image || !mimeType) {
      return res.status(400).json({ error: "base64Image and mimeType required" });
    }

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

    const prompt =
      "Identify all clothing items in this image for a wardrobe manager. " +
      "For each item, return name, category, and color. Return ONLY JSON array.";

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
    res.status(500).json({
      error: err?.message || "Failed to analyze wardrobe image"
    });
  }
});

// ======================================================
// 3) OUTFIT GENERATION (Gemini JSON)
// ======================================================
app.post("/api/generate-outfit", async (req, res) => {
  try {
    if (!apiKey) throw new Error("GEMINI_API_KEY not set on server");
    const { profile, wardrobe, occasion } = req.body;
    if (!profile || !wardrobe || !occasion) {
      return res.status(400).json({ error: "profile, wardrobe, occasion required" });
    }

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
        responseSchema
      }
    });

    const text = result.response.text();
    const outfit = JSON.parse(cleanJSON(text));

    res.json(outfit);
  } catch (err) {
    console.error("generate-outfit error:", err);
    res.status(500).json({
      error: err?.message || "Failed to generate outfit"
    });
  }
});

// ======================================================
// 4) IMAGE GENERATION (Fashion Sketch + Real Look)
//    via Vertex Imagen text-to-image
// ======================================================
app.post("/api/outfit-image", async (req, res) => {
  try {
    const { profile, recommendation, mode } = req.body;

    if (!profile || !recommendation || !mode) {
      return res.status(400).json({
        error: "profile, recommendation, mode required"
      });
    }

    if (mode !== "sketch" && mode !== "real") {
      return res
        .status(400)
        .json({ error: "mode must be 'sketch' or 'real'" });
    }

    const basePrompt = `
Full-body view of a person for a fashion styling app.

Person details:
- Gender: ${profile.gender || "unspecified"}
- Height: ${profile.heightCm || "unknown"} cm
- Weight: ${profile.weightKg || "unknown"} kg
- Skin tone: ${profile.skinTone || "unspecified"}
- Facial features: ${profile.facialFeatures || "soft, natural"}

Outfit details:
- Top: ${recommendation.top?.name || ""}, ${recommendation.top?.color || ""}, ${recommendation.top?.description || ""}
- Bottom: ${recommendation.bottom?.name || ""}, ${recommendation.bottom?.color || ""}, ${recommendation.bottom?.description || ""}
- Shoes: ${recommendation.shoes?.name || ""}, ${recommendation.shoes?.color || ""}, ${recommendation.shoes?.description || ""}
- Accessory: ${recommendation.accessory?.name || ""}, ${recommendation.accessory?.description || ""}

Occasion: ${recommendation.occasion || "general"}.
`.trim();

    const stylePrompt =
      mode === "sketch"
        ? "Clean high-end fashion illustration, line art with subtle color, on a plain background, like a Vogue editorial sketch."
        : "Ultra realistic studio fashion photography, 4K, soft lighting, neutral background, professional model.";

    const finalPrompt = `${basePrompt}\n\nStyle: ${stylePrompt}`;

    const url = `https://${IMAGEN_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${IMAGEN_LOCATION}/publishers/google/models/${IMAGEN_MODEL}:predict`;

    const token = await getAccessToken();

    const body = {
      instances: [
        {
          prompt: finalPrompt
        }
      ],
      parameters: {
        sampleCount: 1,
        outputMimeType: "image/png"
      }
    };

    const imagenRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const json = await imagenRes.json();

    if (!imagenRes.ok) {
      console.error("Imagen error", imagenRes.status, json);
      return res
        .status(500)
        .json({ error: `Imagen error ${imagenRes.status}: ${JSON.stringify(json)}` });
    }

    const prediction =
      json.predictions && json.predictions.length > 0
        ? json.predictions[0]
        : null;

    if (!prediction || !prediction.bytesBase64Encoded) {
      console.error("Unexpected Imagen response", json);
      return res
        .status(500)
        .json({ error: "Imagen response did not contain image bytes" });
    }

    const mime =
      prediction.mimeType && typeof prediction.mimeType === "string"
        ? prediction.mimeType
        : "image/png";

    const dataUrl = `data:${mime};base64,${prediction.bytesBase64Encoded}`;

    return res.json({ imageDataUrl: dataUrl });
  } catch (err) {
    console.error("outfit-image error:", err);
    return res
      .status(500)
      .json({ error: err?.message || "Failed to generate outfit image" });
  }
});

// ---------- SPA FALLBACK ----------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
