app.post("/api/outfit-image", async (req, res) => {
  try {
    const { profile = {}, recommendation = {}, mode = "sketch", occasion = "" } = req.body;

    if (!PROJECT_ID) {
      return res.status(500).json({ error: "PROJECT_ID not set" });
    }

    const top = recommendation.top || {};
    const bottom = recommendation.bottom || {};
    const shoes = recommendation.shoes || {};

    const baseOutfit = `
Top: ${top.color} ${top.name}
Bottom: ${bottom.color} ${bottom.name}
Shoes: ${shoes.color} ${shoes.name}
Occasion: ${occasion}
`;

    let prompt;
    let negativePrompt;
    let instances;

    // =========================
    // 2D FASHION SKETCH
    // =========================
    if (mode === "sketch") {
      prompt = `
Flat 2D fashion illustration of a standing model.
${baseOutfit}

Style:
- pencil sketch
- fashion croquis
- hand-drawn
- clean outlines
- flat colors
- white background
- no realism
- no photography
- no shadows
`;

      negativePrompt =
        "photo, photorealistic, camera, 3d render, lighting, texture, background, depth, extra limbs, extra heads";

      instances = [
        {
          prompt,
        },
      ];
    }

    // =========================
    // REAL LOOK
    // =========================
    else {
      prompt = `
Professional studio photograph of a person standing straight,
neutral pose, arms relaxed.

${baseOutfit}

Style:
- modern studio
- neutral background
- realistic proportions
- no dramatic pose
- no artistic composition
`;

      negativePrompt =
        "drawing, sketch, cartoon, illustration, anime, painting, dramatic pose, sitting, lying, multiple people, extra limbs, extra heads";

      instances = [
        {
          prompt,
          referenceImages: profile.avatarImage
            ? [
                {
                  referenceType: "REFERENCE_TYPE_RAW",
                  referenceId: 1,
                  referenceImage: {
                    bytesBase64Encoded: profile.avatarImage.split(",")[1],
                  },
                },
              ]
            : [],
        },
      ];
    }

    const token = await getAccessToken();
    const url = `https://${IMAGEN_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${IMAGEN_LOCATION}/publishers/google/models/${IMAGEN_MODEL}:predict`;

    const body = {
      instances,
      parameters: {
        sampleCount: 1,
        aspectRatio: "3:4",
        negativePrompt,
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
      return res.status(500).json({ error: "Imagen failed", detail: json });
    }

    const img = json.predictions?.[0]?.bytesBase64Encoded;
    if (!img) {
      return res.status(500).json({ error: "No image returned" });
    }

    res.json({ imageDataUrl: `data:image/png;base64,${img}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Outfit image failed" });
  }
});
