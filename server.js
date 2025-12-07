import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';

const app = express();
const port = 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable JSON parsing
app.use(express.json());

// 1. Serve the React Frontend (Static Files)
app.use(express.static(path.join(__dirname, 'dist')));

// 2. SECURE API ENDPOINT for Real Images (Vertex AI)
app.post('/api/generate-real-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    // Authenticate using Cloud Run's built-in identity (Uses your Credits)
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    const accessToken = await client.getAccessToken();

    // Call Vertex AI (Imagen 3)
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "9:16", // Perfect for full body fashion
          personGeneration: "allow_adult" // Required to generate people
        }
      })
    });

    const data = await response.json();
    
    if (data.predictions && data.predictions[0]) {
      // Imagen returns base64, we send it back to frontend
      const base64Image = data.predictions[0].bytesBase64Encoded;
      res.json({ success: true, image: `data:image/png;base64,${base64Image}` });
    } else {
      console.error("Vertex AI Error:", JSON.stringify(data));
      res.status(500).json({ error: "Failed to generate image via Vertex AI" });
    }

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Handle React Routing (Redirect all other requests to index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
