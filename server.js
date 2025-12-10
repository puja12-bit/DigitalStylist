// server.js - REST-only Gemini v1 backend

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

// ========= CONFIG =========
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn("⚠ GEMINI_API_KEY is not set. Gemini calls will fail.");
}

// Valid v1 model
const GEMINI_MODEL = "gemini-2.0-flash";

const cleanJSON = (txt) => txt.replace(/```json|```/g, "").trim();

// ========= LOW-LEVEL HELPER (REST v1) =========
async function callGeminiJSON({ contents }) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;

  const body = {
    contents,
    generationConfig: {
      responseMimeType: "application/json",
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

// ========= 1) PROFILE ANALYSIS =========

app.post("/api/analyze-profile-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    if (!base64Image || !mimeType) {
      return res
        .status(400)
        .json({ error: "base64Image and mimeType are required" });
    }

    const content = base64Image.split(",")[1] || base64Image;

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

Return ONLY JSON in this shape:
{
  "gender": "...",
  "estimatedHeightCm": 170,
  "estimatedWeightKg": 65,
  "skinTone": "Medium",
  "facialFeatures": "..."
}
`;

    const parsed = await callGeminiJSON({
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

// ========= 2) OUTFIT GENERATION =========

app.post("/api/generate-outfit", async (req, res) => {
  try {
    const { profile, wardrobe, occasion } = req.body || {};

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

Return ONLY JSON in this shape:
{
  "top":    { "name": "...", "description": "...", "color": "...", "source": "Wardrobe"|"Shopping", "reasoning": "..." },
  "bottom": { "name": "...", "description": "...", "color": "...", "source": "Wardrobe"|"Shopping", "reasoning": "..." },
  "shoes":  { "name": "...", "description": "...", "color": "...", "source": "Wardrobe"|"Shopping", "reasoning": "..." },
  "accessory": { "name": "...", "description": "...", "color": "...", "source": "Wardrobe"|"Shopping", "reasoning": "..." },
  "hairstyle": "....",
  "hairstyleReasoning": "...",
  "confidenceTip": "...",
  "overallVibe": "..."
}
`;

    const parsed = await callGeminiJSON({
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

// ========= SPA FALLBACK =========

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log("🚀 REST Gemini server running on port", PORT);
});
