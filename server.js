// =====================================================================
// DIGITAL STYLIST AI - SERVER
// =====================================================================
// - Gemini 2.0 Pro for profile + outfit (better accuracy)
// - Gemini 2.0 Flash for wardrobe (cheaper, good enough)
// - Imagen 3.0 capability model for user-photo editing (sketch + real)
// - Strict occasion rules (interview/office/party/wedding/date)
// - Robust profile analysis route with SAFE FALLBACK (no 500s)
// =====================================================================

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

// ------------------------------------------------------------
// IMAGEN EDIT CONFIG
// ------------------------------------------------------------
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "digitalstylist";
const IMAGEN_LOCATION = "us-central1";
// Edit-capable model (user-photo editing)
const IMAGEN_MODEL = "imagen-3.0-capability-001";

// Cloud Run metadata token
async function getAccessToken() {
  const res = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: { "Metadata-Flavor": "Google" },
    }
  );

  if (!res.ok) throw new Error("Failed to fetch identity token");

  const json = await res.json();
  return json.access_token;
}

// =======================================================================
// 1) PROFILE ANALYSIS (GEMINI 2.0 PRO) — ROBUST + SAFE FALLBACK
// =======================================================================
app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    const raw = req.body || {};
    console.log("analyze-profile-image body keys:", Object.keys(raw));

    let base64Image =
      raw.base64Image ||
      raw.imageBase64 ||
      raw.imageDataUrl ||
      raw.image ||
      null;

    let mimeType =
      raw.mimeType ||
      raw.type ||
      (typeof base64Image === "string"
        ? (base64Image.match(/^data:(.*?);base64,/) || [])[1]
        : null) ||
      "image/jpeg";

    if (!base64Image) {
      console.warn("No base64Image in request body");
      return res.status(400).json({
        error:
          "Missing image data. Expected base64Image / imageBase64 / imageDataUrl.",
      });
    }

    const content = base64Image.split(",")[1] || base64Image;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      safetySettings,
    });

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
Be precise and realistic. If anything is unclear, use "uncertain" instead of guessing.

Return JSON with:
- gender: "male", "female", or "uncertain"
- estimatedHeightCm: number
- estimatedWeightKg: number
- skinTone: ONE OF ["Fair","Light","Medium","Olive","Tan","Dark","Deep"]
- facialFeatures: 1–2 sentences describing jawline, nose, lips, eyebrows, hairstyle, overall vibe.
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


// =======================================================================
// 2) WARDROBE ANALYSIS (GEMINI 2.0 FLASH)
// =======================================================================
app.post("/api/analyze-wardrobe-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body;
    if (!base64Image || !mimeType) {
      return res
        .status(400)
        .json({ error: "base64Image and mimeType are required" });
    }

    const model = genAI.getGenerativeAIModel?.({
      model: "gemini-2.0-flash",
      safetySettings,
    }) ?? genAI.getGenerativeModel({ model: "gemini-2.0-flash", safetySettings });

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

    const content = base64Image.split(",")[1] || base64Image;

    const prompt = `
Identify every clothing item in this image.
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
    console.error("analyze-wardrobe-image error", e);
    res.status(500).json({ error: e.message || "Wardrobe analysis failed" });
  }
});

// =======================================================================
// 3) OUTFIT GENERATION (GEMINI 2.0 PRO, STRONG OCCASION RULES)
// =======================================================================
app.post("/api/generate-outfit", async (req, res) => {
  try {
    const { profile, wardrobe, occasion } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-pro",
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
- FORBIDDEN: kurta pajama, sherwani, lehenga, anarkali, or similar festive outfits.
- ALLOWED: shirts, blouses, blazers, trousers, chinos, pencil skirts, sheath dresses.
- COLORS: navy, black, grey, beige, white, soft muted colors. Avoid loud/neon colors.
- SHOES: formal closed-toe, clean, minimal.
`;
    } else if (o.includes("office") || o.includes("work")) {
      occasionRules = `
OCCASION CATEGORY: OFFICE / WORK

RULES:
- Polished but comfortable.
- FORBIDDEN: wedding-style ethnic sets, heavy shine or sequins.
- ALLOWED: shirts, blouses, smart casual kurtas (plain/minimal), trousers, chinos, straight pants, modest dresses.
- SHOES: loafers, flats, low heels, clean sneakers (only if "casual" tone).
`;
    } else if (
      o.includes("party") ||
      o.includes("wedding") ||
      o.includes("festive")
    ) {
      occasionRules = `
OCCASION CATEGORY: FESTIVE / WEDDING / PARTY

RULES:
- Ethnic wear, color and shine are allowed.
- Still keep it tasteful, not costume-like.
- Match vibe: elegant, confident, not overdone.
`;
    } else if (o.includes("date")) {
      occasionRules = `
OCCASION CATEGORY: DATE

RULES:
- Flattering silhouette, comfortable, confident.
- Avoid overly formal or overly sporty outfits.
- Choose colors that flatter the user's skin tone.
`;
    }

    const prompt = `
You are a professional stylist.

USER PROFILE:
- Gender: ${profile.gender || "unknown"}
- Height: ${profile.heightCm || "unknown"} cm
- Weight: ${profile.weightKg || "unknown"} kg
- Skin tone: ${profile.skinTone || "unknown"}
- Face / vibe: ${profile.facialFeatures || "unknown"}

OCCASION (user text): "${occasion}"

${occasionRules}

WARDROBE (USE THESE FIRST):
${wardrobeList || "(empty wardrobe — may need Shopping items)"}

HARD RULES:
1. The outfit MUST clearly fit the occasion rules above.
2. For interviews / office:
   - NO shiny / glittery / heavily embroidered / wedding outfits.
   - NO kurta pajama / sherwani / lehenga / anarkali unless occasion explicitly says traditional or wedding.
3. Use wardrobe items first. Only mark an item as "Shopping" when the wardrobe truly lacks that category (e.g. no formal shoes).
4. Colors and descriptions must be consistent with the items you list.
5. Explain reasoning for each item briefly (why it fits the occasion and the user's body/skin tone).
6. Return ONLY valid JSON in the exact response schema. No markdown, no prose, no comments.
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
    console.error("generate-outfit error", e);
    res.status(500).json({ error: e.message || "Outfit generation failed" });
  }
});

// =======================================================================
// 4) IMAGEN EDIT — USER PHOTO → FASHION SKETCH + REAL LOOK
// =======================================================================
app.post("/api/outfit-image", async (req, res) => {
  try {
    const { profile, recommendation, mode } = req.body;

    if (!profile?.avatarImage) {
      return res.status(400).json({ error: "profile.avatarImage is required" });
    }

    if (mode !== "sketch" && mode !== "real") {
      return res
        .status(400)
        .json({ error: "mode must be 'sketch' or 'real'" });
    }

    const avatarBase64 =
      profile.avatarImage.split(",")[1] || profile.avatarImage;

    const top = recommendation?.top || {};
    const bottom = recommendation?.bottom || {};
    const shoes = recommendation?.shoes || {};
    const accessory = recommendation?.accessory || {};

    const editPrompt = `
You are modifying ONLY the clothing on this person for a fashion styling app.

KEEP EXACTLY:
- Face, facial expression
- Body shape and proportions
- Pose
- Background and lighting
- Overall identity and skin tone

CHANGE ONLY:
- Clothing (top, bottom, shoes, accessory)

OUTFIT SPECIFICATION (STRICT):
- Top: ${top.color || ""} ${top.name || ""}. Style: ${
      top.description || ""
    }
- Bottom: ${bottom.color || ""} ${bottom.name || ""}. Style: ${
      bottom.description || ""
    }
- Shoes: ${shoes.color || ""} ${shoes.name || ""}. Style: ${
      shoes.description || ""
    }
- Accessory: ${accessory.name || ""}. Style: ${accessory.description || ""}

IMAGE QUALITY RULES:
- Clothes must be clearly visible and distinct from skin.
- The outline of each garment (shirt, trousers, skirt, dress) must be clean and readable.
- No color bleeding, no weird overlapping textures.
- No distortions on hands, face or feet.
`;

    const stylePrompt =
      mode === "sketch"
        ? "Render as a clean high-end fashion illustration, white or very light background, clear lines, subtle colors."
        : "Render as a crisp photorealistic full-body fashion photo, studio-quality lighting, neutral background.";

    const finalPrompt = `${editPrompt}\n\nSTYLE:\n${stylePrompt}`;

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
              referenceImage: { bytesBase64Encoded: avatarBase64 },
            },
          ],
        },
      ],
      parameters: {
        sampleCount: 1,
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
      console.error("Imagen error", resp.status, json);
      return res.status(500).json({
        error: `Imagen error ${resp.status}`,
        details: json,
      });
    }

    const pred = json.predictions?.[0];
    if (!pred?.bytesBase64Encoded) {
      console.error("Imagen: no image in response", json);
      return res.status(500).json({ error: "No image returned from Imagen" });
    }

    res.json({
      imageDataUrl: `data:image/png;base64,${pred.bytesBase64Encoded}`,
    });
  } catch (e) {
    console.error("outfit-image error", e);
    res
      .status(500)
      .json({ error: e.message || "Outfit image generation failed" });
  }
});

// =======================================================================
// SPA FALLBACK
// =======================================================================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// =======================================================================
// START
// =======================================================================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
