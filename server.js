import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';

const app = express();
const port = 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allow large requests
app.use(express.json({ limit: '10mb' }));

// Serve the React App
app.use(express.static(path.join(__dirname, 'dist')));

// --- THE CLOUD CREDITS API ---
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, style } = req.body;
    
    // 1. Authenticate using your $300 Credits (Cloud Run Identity)
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    const accessToken = await client.getAccessToken();

    // 2. Define the Style Prompt
    let styleModifier = "";
    if (style === '2D') {
      styleModifier = "Style: Professional fashion design illustration. Medium: Copic markers and ink. Background: Clean white. High fashion sketch style.";
    } else {
      styleModifier = "Style: Photorealistic, 4k, Cinematic fashion photography. Lighting: Studio softbox. Quality: Highly detailed, realistic textures.";
    }

    const finalPrompt = `${styleModifier} ${prompt}`;

    // 3. Call Vertex AI (Imagen 3)
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [{ prompt: finalPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "9:16", // Full body portrait
          personGeneration: "allow_adult" // Essential for fashion models
        }
      })
    });

    const data = await response.json();

    if (data.predictions && data.predictions[0]) {
      const base64Image = data.predictions[0].bytesBase64Encoded;
      res.json({ success: true, image: `data:image/png;base64,${base64Image}` });
    } else {
      console.error("Vertex AI Error:", JSON.stringify(data));
      res.status(500).json({ error: "Image generation failed at Vertex AI." });
    }

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Handle React Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
