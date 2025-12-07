// server.ts (or server.js)

import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ─── CONFIG ──────────────────────────────────────────────

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT || "digitalstylist"; // Cloud Run sets this
const IMAGEN_REGION = "us-central1"; // Imagen is definitely available here

// Strip "data:image/...;base64," prefix if present
function stripDataUrl(dataUrl: string): string {
  if (!dataUrl) return "";
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

// Get access token from metadata server (Cloud Run default SA)
async function getAccessToken(): Promise<string> {
  const res = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: { "Metadata-Flavor": "Google" },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Metadata token error ${res.status}: ${text || res.statusText}`
    );
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("No access_token from metadata");
  return json.access_token;
}

// ─── NEW ROUTE: /api/outfit-image ────────────────────────
// This will be called by "Fashion Sketch" and "Real Look" tabs.

app.post("/api/outfit-image", async (req, res) => {
  try {
    const { mode, profile, outfit } = req.body;

    if (mode !== "sketch" && mode !== "real") {
      return res.status(400).json({ error: "mode must be 'sketch' or 'real'" });
    }
    if (!profile || !outfit) {
      return res
        .status(400)
        .json({ error: "profile and outfit are required in body" });
    }

    // Build a strong text prompt for Imagen
    const basePrompt = `
      Full-body view of a person for a fashion styling app.

      Person details:
      - Gender: ${profile.gender || "unspecified"}
      - Height: ${profile.heightCm || "unknown"} cm
      - Weight: ${profile.weightKg || "unknown"} kg
      - Skin tone: ${profile.skinTone || "unspecified"}
      - Facial features: ${profile.facialFeatures || "soft, natural"}

      Outfit details:
      - Top: ${outfit.top?.name || ""}, ${outfit.top?.color || ""}, ${
      outfit.top?.description || ""
    }
      - Bottom: ${outfit.bottom?.name || ""}, ${outfit.bottom?.color || ""}, ${
      outfit.bottom?.description || ""
    }
      - Shoes: ${outfit.shoes?.name || ""}, ${outfit.shoes?.color || ""}, ${
      outfit.shoes?.description || ""
    }
      - Accessory: ${
        outfit.accessory?.name || ""
      }, ${outfit.accessory?.description || ""}

      Occasion: ${outfit.occasion || "daily wear"}.
    `.trim();

    const stylePrompt =
      mode === "sketch"
        ? "Clean high-end fashion illustration, line art with subtle color, on a plain background, like a style board sketch."
        : "Ultra realistic 4K studio fashion photography, soft lighting, professional model, neutral background.";

    const finalPrompt = `${basePrompt}\n\nStyle: ${stylePrompt}`;

    // Imagen text-to-image endpoint
    const modelId = "imagegeneration"; // base Imagen model family
    const url = `https://${IMAGEN_REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${IMAGEN_REGION}/publishers/google/models/${modelId}:predict`;

    const token = await getAccessToken();

    // NOTE: This JSON shape follows the Imagen predict docs.
    // If Google tweaks it, adjust using the docs – but the pattern is:
    //   instances: [{ prompt: "..." }], parameters: { ... }
    const body = {
      instances: [
        {
          // Some versions use { "prompt": "text..." }, others { "prompt": { "text": "..." } }.
          // If the first form fails, change to { prompt: { text: finalPrompt } }.
          prompt: finalPrompt,
        },
      ],
      parameters: {
        sampleCount: 1,
        // safer settings to start with:
        addWatermark: true,
        aspectRatio: "1:1", // or "9:16" for vertical
        // you can add other parameters later (seed, negativePrompt, etc.)
        outputOptions: {
          mimeType: "image/png",
        },
      },
    };

    const imagenRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
  } catch (err: any) {
    console.error("Outfit image generation failed", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to generate outfit image" });
  }
});

// ─── existing routes (analyze-profile-image, analyze-wardrobe-image, generate-outfit) stay as they are ───

// Start server (in Cloud Run Dockerfile you already expose PORT)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
