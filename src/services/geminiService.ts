import { GoogleGenAI, Type, ImageGenerationConfig } from "@google/genai";
import { UserProfile, WardrobeItem, OutfitRecommendation, SkinTone } from "../types";

// Helper to sanitize the response text into valid JSON
const cleanJSON = (text: string): string => {
  return text.replace(/```json\s*|\s*```/g, "").trim();
};

const fileToPart = (base64Data: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64Data,
      mimeType
    }
  };
};

export const analyzeUserProfileFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Partial<UserProfile>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const schema = {
    type: Type.OBJECT,
    properties: {
      gender: { type: Type.STRING, enum: ["Male", "Female", "Non-Binary"] },
      estimatedHeightCm: { type: Type.NUMBER },
      estimatedWeightKg: { type: Type.NUMBER },
      skinTone: { type: Type.STRING, enum: Object.values(SkinTone) },
      facialFeatures: { type: Type.STRING, description: "Detailed description of face shape, hair, facial hair, etc." },
    },
    required: ["gender", "estimatedHeightCm", "estimatedWeightKg", "skinTone", "facialFeatures"]
  };

  const prompt = "Analyze this person's physical attributes for a fashion styling app. Estimate gender, height (in cm), weight (in kg), skin tone (strictly pick the closest match), and describe facial features. Be respectful and objective.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          fileToPart(base64Image, mimeType),
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const data = JSON.parse(cleanJSON(response.text || "{}"));
    
    return {
      gender: data.gender,
      heightCm: data.estimatedHeightCm,
      weightKg: data.estimatedWeightKg,
      skinTone: data.skinTone as SkinTone,
      facialFeatures: data.facialFeatures
    };

  } catch (error) {
    console.error("Profile Analysis Error:", error);
    throw new Error("Could not analyze image. Please try manually entering data.");
  }
};

export const analyzeWardrobeFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<WardrobeItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Specific name of item e.g. 'Distressed Denim Jacket'" },
        category: { type: Type.STRING, enum: ["Top", "Bottom", "Shoes", "Accessory", "Outerwear"] },
        color: { type: Type.STRING, description: "Precise color name e.g. 'Navy Blue', 'Charcoal'" }
      },
      required: ["name", "category", "color"]
    }
  };

  const prompt = "Identify all clothing items, shoes, or accessories in this image. For each item, provide a category, a specific color name, and a descriptive name.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          fileToPart(base64Image, mimeType),
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const items = JSON.parse(cleanJSON(response.text || "[]"));
    
    return items.map((item: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      ...item
    }));

  } catch (error) {
    console.error("Wardrobe Analysis Error:", error);
    throw new Error("Could not identify items in image.");
  }
};

export const generateOutfit = async (
  profile: UserProfile,
  wardrobe: WardrobeItem[],
  occasion: string
): Promise<OutfitRecommendation> => {
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const itemSchema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Name of the item (e.g., White Linen Shirt)" },
      description: { type: Type.STRING, description: "Brief description of style/fit" },
      color: { type: Type.STRING, description: "Color of the item" },
      source: { type: Type.STRING, enum: ["Wardrobe", "Shopping"], description: "Whether this comes from user's wardrobe or needs to be bought" },
      reasoning: { type: Type.STRING, description: "Why this specific item fits the user and occasion" },
    },
    required: ["name", "description", "color", "source", "reasoning"]
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      top: itemSchema,
      bottom: itemSchema,
      shoes: itemSchema,
      accessory: itemSchema,
      hairstyle: { type: Type.STRING, description: "Recommended hairstyle name" },
      hairstyleReasoning: { type: Type.STRING, description: "Why this hairstyle suits user's face shape" },
      confidenceTip: { type: Type.STRING, description: "A tip to boost confidence for this specific occasion" },
      overallVibe: { type: Type.STRING, description: "Description of the overall look" },
    },
    required: ["top", "bottom", "shoes", "accessory", "hairstyle", "hairstyleReasoning", "confidenceTip", "overallVibe"]
  };

  const wardrobeList = wardrobe.map(w => `- ${w.color} ${w.name} (${w.category})`).join("\n");

  const systemInstruction = "You are a world-class fashion stylist specializing in color theory, body types, and confidence coaching.";

  const prompt = `
    User Profile:
    - Gender: ${profile.gender}
    - Height: ${profile.heightCm}cm
    - Weight: ${profile.weightKg}kg
    - Skin Tone: ${profile.skinTone}
    - Facial Features: ${profile.facialFeatures}

    Occasion: "${occasion}"

    User's Existing Wardrobe:
    ${wardrobeList.length > 0 ? wardrobeList : "The user has no items recorded. You MUST recommend shopping items."}

    Goal: Create the perfect outfit for this specific occasion that maximizes the user's confidence.
    
    Guidelines:
    1. PRIORITIZE items from the "User's Existing Wardrobe". Only suggest "Shopping" items if the wardrobe is completely unsuitable or missing a critical piece (like a suit for a formal interview when they only have shorts).
    2. Consider the user's skin tone for color selection.
    3. Consider the user's height/weight for fit recommendations.
    4. Consider facial features for hairstyle and accessory choice.
    5. The "source" field in the JSON MUST be strictly "Wardrobe" if the item exists in the provided list, otherwise "Shopping".
    
    Return the response strictly in JSON format matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4, 
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(cleanJSON(text)) as OutfitRecommendation;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate outfit. Please check your API key and try again.");
  }
};

export const generateOutfitImage = async (
  recommendation: OutfitRecommendation,
  profile: UserProfile,
  style: '2D' | 'REAL' = '2D'
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let prompt = "";
  const parts: any[] = [];
  let model = "gemini-2.5-flash-image";
  let imageConfig: ImageGenerationConfig | undefined = undefined;

  const outfitDescription = `
    Top: ${recommendation.top.color} ${recommendation.top.name} - ${recommendation.top.description}
    Bottom: ${recommendation.bottom.color} ${recommendation.bottom.name} - ${recommendation.bottom.description}
    Shoes: ${recommendation.shoes.color} ${recommendation.shoes.name}
    Accessory: ${recommendation.accessory.name}
    Hairstyle: ${recommendation.hairstyle}
  `;

  if (style === 'REAL') {
    model = "gemini-3-pro-image-preview";
    imageConfig = { imageSize: "1K" };
    prompt = `
      Generate a photorealistic, 4K, cinematic, high-quality full-body image of a person matching the description below wearing this exact outfit.
      
      Outfit:
      ${outfitDescription}

      Model Features:
      Gender: ${profile.gender}
      Skin Tone: ${profile.skinTone}
      Facial Features: ${profile.facialFeatures}
      
      Setting: An appropriate background for the occasion (e.g., office for work, cafe for date).
      The image should look like a professional fashion photography shot.
      ${profile.avatarImage ? "Make the person in the generated image resemble the person in the provided reference image." : ""}
    `;

    if (profile.avatarImage) {
      parts.push(fileToPart(profile.avatarImage, 'image/jpeg')); 
    }

  } else {
    // 2D Sketch
    prompt = `
      Generate a high-fashion, realistic 2D full-body illustration/sketch of a person wearing this exact outfit:
      
      ${outfitDescription}
      
      Model details:
      Gender: ${profile.gender}
      Skin Tone: ${profile.skinTone}
      Hairstyle: ${recommendation.hairstyle}
      
      Style: Professional fashion design sketch, clean background, artistic but clear details. Focus on the clothing fit and coordination.
    `;
  }

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: imageConfig ? { imageConfig } : undefined,
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null; 
  }
};