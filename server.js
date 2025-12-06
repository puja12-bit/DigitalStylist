import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// parse JSON including big base64 images
app.use(express.json({ limit: "15mb" }));

// serve built React app from /dist
app.use(express.static(path.join(__dirname, "dist")));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not set – image API will fail.");
}
const genAI = new GoogleGenerativeAI(apiKey);

// POST /api/outfit-image
app.post("/api/outfit-image", async (req, res) => {
  try {
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY env var is not set on the server." });
    }

    const { profile, recommendation, mode } = req.body;

    if (!profile?.avatarImage) {
      return res
        .status(400)
        .json({ error: "profile.avatarImage (base64) is required." });
    }

    const avatarBase64 = profile.avatarImage.split(",")[1] || profile.avatarImage;
    const avatarMime =
      profile.avatarImage.includes("image/png") ? "image/png" : "image/jpeg";

    const outfitDescription = [
      recommendation.top && `${recommendation.top.color} ${recommendation.top.name}`,
      recommendation.bottom &&
        `${recommendation.bottom.color} ${recommendation.bottom.name}`,
      recommendation.shoes &&
        `${recommendation.shoes.color} ${recommendation.shoes.name}`,
      recommendation.accessory &&
        `${recommendation.accessory.color} ${recommendation.accessory.name}`,
    ]
      .filter(Boolean)
      .join(", ");

    const styleText =
      mode === "FASHION_SKETCH"
        ? "in a clean digital fashion sketch / editorial illustration style, simple background"
        : "as a high-quality photorealistic full-body portrait, studio lighting, simple background";

    const prompt = `
      You are a virtual stylist renderer.
      Take this person's photo and redraw them wearing this outfit: ${outfitDescription}.
      Preserve their identity, face and body shape.
      Show full body or at least from head to knees.
      Render ${styleText}.
    `;

    const model = genAI.getGenerativeAIModel
      ? genAI.getGenerativeAIModel({ model: "gemini-2.0-flash" })
      : genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: avatarBase64,
                mimeType: avatarMime,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "image/png",
      },
    });

    const response = result.response;
    if (
      !response ||
      !response.candidates ||
      !response.candidates[0] ||
      !response.candidates[0].content ||
      !response.candidates[0].content.parts ||
      !response.candidates[0].content.parts[0].inlineData
    ) {
      console.error("Unexpected Gemini response structure", response);
      return res.status(500).json({ error: "No image returned from Gemini." });
    }

    const inline = response.candidates[0].content.parts[0].inlineData;
    const imageDataUrl = `data:${inline.mimeType};base64,${inline.data}`;

    res.json({ imageDataUrl });
  } catch (err) {
    console.error("backend /api/outfit-image error", err);
    res.status(500).json({ error: "Image generation failed." });
  }
});

// SPA fallback – send index.html for anything else
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
