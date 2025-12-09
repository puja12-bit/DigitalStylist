// server.js - REST-based Gemini v1 + Imagen

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

// ======== CONFIG ========
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn("⚠ GEMINI_API_KEY is not set. Gemini calls will fail.");
}

// We use v1 REST + a valid v1 model
const GEMINI_MODEL = "gemini-2.0-flash";

// Vertex / Imagen config (if you're using outfit image generation)
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "digitalstylist";
const IMAGEN_LOCATION = "us-central1";
const IMAGEN_MODEL = "imagen-3.0-capability-001";

const cleanJSON = (txt) => txt.replace(/```json|```/g, "").trim();

// ======== LOW-LEVEL HELPERS ========

// Call Gemini v1 REST and return parsed JSON object based on responseMimeType=application/json
async function callGeminiJSON({ model, contents, responseSchema }) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;

  const body = {
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      ...(responseSchema ? { responseSchema } : {}),
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_NONE",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_NONE",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_NONE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE",
      },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await resp.json();

  if (!resp.ok) {
    console.error("Gemini REST error:", resp.status, data);
    throw new Error(
      `[Gemini REST ${resp.status}] ${data.error?.message || "Unknown error"}`
    );
  }

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join(" ")
      .trim() || "";

  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  return JSON.parse(cleanJSON(text));
}

// Obtain GCP access token for Imagen if you use that path
async function getAccessToken() {
  const resp = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: { "Metadata-Flavor": "Google" },
    }
  );

  if (!resp.ok) throw new Error("Failed to fetch metadata token");

  return (await resp.json()).access_token;
}

// ======== 1) PROFILE ANALYSIS ========

app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    if (!base64Image || !mimeType) {
      return res
        .status(400)
        .json({ error: "base64Image and mimeType are required" });
    }

    const content = base64Image.split(",")[1] || base64Image;

    const schema = {
      type: "OBJECT",
      properties: {
        gender: { type: "STRING" },
        estimatedHeightCm: { type: "NUMBER" },
        estimatedWeightKg: { type: "NUMBER" },
        skinTone: { type: "STRING" },
        facialFeatures: { type: "STRING" },
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
You are analyzing a person's appearance for a fashion styling app.

Look at the photo and estimate:
- gender
- height in cm
- weight in kg
- skinTone: choose ONE of ["Fair","Light","Medium","Olive","Tan","Dark","Deep"]
- facialFeatures: a SHORT description like
  "Soft round face, medium-sized eyes, defined brows, small nose, full lips."

Keep facialFeatures in 1–2 sentences, not a single word.
Return ONLY JSON.
`;

    const parsed = await callGeminiJSON({
      model: GEMINI_MODEL,
      responseSchema: schema,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: content, mimeType } },
            { text: prompt },
          ],
        },
      ],
    });

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

// ======== 2) OUTFIT GENERATION ========

app.post("/api/generate-outfit", async (req, res) => {
  try {
    const { profile, wardrobe, occasion } = req.body || {};

    const itemSchema = {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        description: { type: "STRING" },
        color: { type: "STRING" },
        source: { type: "STRING", enum: ["Wardrobe", "Shopping"] },
        reasoning: { type: "STRING" },
      },
      required: ["name", "description", "color", "source", "reasoning"],
    };

    const responseSchema = {
      type: "OBJECT",
      properties: {
        top: itemSchema,
        bottom: itemSchema,
        shoes: itemSchema,
        accessory: itemSchema,
        hairstyle: { type: "STRING" },
        hairstyleReasoning: { type: "STRING" },
        confidenceTip: { type: "STRING" },
        overallVibe: { type: "STRING" },
        occasion: { type: "STRING" },
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
- COLORS: navy, black, grey, beige, white, muted tones. Avoid neon.
- SHOES: formal closed-toe, clean, minimal.
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
1. Outfit must clearly match the occasion rules.
2. For interviews: no shiny/festive/ethnic wedding outfits.
3. Use wardrobe items first; only use "Shopping" when wardrobe truly lacks that category.
4. Colors and descriptions must be consistent.
5. Return ONLY valid JSON according to the schema above. No markdown, no extra text.
`;

    const parsed = await callGeminiJSON({
      model: GEMINI_MODEL,
      responseSchema,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    parsed.occasion = occasion;
    return res.json(parsed);
  } catch (e) {
    console.error("generate-outfit error:", e);
    return res
      .status(500)
      .json({ error: e?.message || "Outfit generation failed" });
  }
});

// ======== 3) (Optional) OUTFIT IMAGE via IMAGEN ========
// If you already have this in a previous version, keep your existing route.
// I'll leave this stub minimal so we don't introduce new breakage.

app.post("/api/outfit-image", async (req, res) => {
  try {
    const { profile, recommendation, mode } = req.body || {};
    if (!profile?.avatarImage) {
      return res.status(400).json({ error: "profile.avatarImage is required" });
    }
    if (mode !== "sketch" && mode !== "real") {
      return res.status(400).json({ error: "mode must be 'sketch' or 'real'" });
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
- Face, expression, identity, skin tone
- Body shape and proportions
- Pose
- Background and lighting

CHANGE ONLY:
- Clothing (top, bottom, shoes, accessory)

OUTFIT:
- Top: ${top.color || ""} ${top.name || ""}. ${top.description || ""}
- Bottom: ${bottom.color || ""} ${bottom.name || ""}. ${
      bottom.description || ""
    }
- Shoes: ${shoes.color || ""} ${shoes.name || ""}. ${shoes.description || ""}
- Accessory: ${accessory.name || ""}. ${accessory.description || ""}`;

    const stylePrompt =
      mode === "sketch"
        ? "Render as a clean high-end fashion illustration, light background, clear garment outlines."
        : "Render as a crisp photorealistic fashion photo, neutral background, studio lighting.";

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

    return res.json({
      imageDataUrl: `data:image/png;base64,${pred.bytesBase64Encoded}`,
    });
  } catch (e) {
    console.error("outfit-image error:", e);
    return res
      .status(500)
      .json({ error: e?.message || "Outfit image generation failed" });
  }
});

// ======== SPA FALLBACK ========
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
