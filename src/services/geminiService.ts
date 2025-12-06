import {
  GoogleGenerativeAI,
  SchemaType,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

import {
  UserProfile,
  WardrobeItem,
  OutfitRecommendation,
  SkinTone,
} from "../types";

// -------------------------------------------------------------------
// API KEY SOURCE: runtime env.js injected by Cloud Run
// window.__ENV is defined in env.js and overwritten at container start.
// -------------------------------------------------------------------

declare global {
  interface Window {
    __ENV?: {
      GEMINI_API_KEY?: string;
    };
  }
}

const API_KEY = window.__ENV?.GEMINI_API_KEY || "";

// Create client, throw clear error if key missing
const getClient = () => {
  if (!API_KEY) {
    throw new Error(
      "API Key missing. Set GEMINI_API_KEY env var in Cloud Run and make sure env.js is loaded."
    );
  }
  return new GoogleGenerativeAI(API_KEY);
};

// Clean ```json ... ``` wrappers from model responses
const cleanJSON = (text: string): string =>
  text.replace(/```json\s*|\s*```/g, "").trim();

// Base64 → Gemini inlineData
const fileToPart = (base64Data: string, mimeType: string) => {
  const base64Content = base64Data.split(",")[1] || base64Data;
  return {
    inlineData: {
      data: base64Content,
      mimeType,
    },
  };
};

// Safety settings
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

// -------------------------------------------------------------------
// 1) Analyze User Profile from Image
// -------------------------------------------------------------------
export const analyzeUserProfileFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Partial<UserProfile>> => {
  const genAI = getClient();

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
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

  const prompt =
    "Analyze this person's physical attributes for a fashion styling app. " +
    "Estimate gender, height (cm), weight (kg), skin tone, and describe facial features. Return JSON.";

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [fileToPart(base64Image, mimeType), { text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = result.response.text();
    const data = JSON.parse(cleanJSON(text));

    return {
      gender: data.gender,
      heightCm: data.estimatedHeightCm,
      weightKg: data.estimatedWeightKg,
      skinTone: data.skinTone as SkinTone,
      facialFeatures: data.facialFeatures,
    };
  } catch (error: any) {
    console.error("Profile Analysis Error:", error);
    throw new Error(error.message || "Failed to analyze profile image.");
  }
};

// -------------------------------------------------------------------
// 2) Analyze Wardrobe from Image
// -------------------------------------------------------------------
export const analyzeWardrobeFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<WardrobeItem[]> => {
  const genAI = getClient();

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    safetySettings,
  });

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

  const prompt =
    "Identify all clothing items in this image. Return name, category, and color as a JSON array.";

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [fileToPart(base64Image, mimeType), { text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = result.response.text();
    const items = JSON.parse(cleanJSON(text));

    return items.map((item: any) => ({
      id: Math.random().toString(36).substring(2, 9),
      ...item,
    }));
  } catch (error: any) {
    console.error("Wardrobe Analysis Error:", error);
    throw new Error(error.message || "Wardrobe analysis failed.");
  }
};

// -------------------------------------------------------------------
// 3) Generate Outfit
// -------------------------------------------------------------------
export const generateOutfit = async (
  profile: UserProfile,
  wardrobe: WardrobeItem[],
  occasion: string
): Promise<OutfitRecommendation> => {
  const genAI = getClient();

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
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

  const wardrobeList = wardrobe
    .map((w) => `- ${w.color} ${w.name} (${w.category})`)
    .join("\n");

  const prompt = `
    User Profile: ${profile.gender}, ${profile.heightCm}cm, ${profile.weightKg}kg, ${profile.skinTone}, ${profile.facialFeatures}
    Occasion: "${occasion}"
    Wardrobe:
    ${wardrobeList}

    Create a complete outfit. Prioritize existing wardrobe. Use "Wardrobe" vs "Shopping" correctly.
    Return JSON.
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const text = result.response.text();
    return JSON.parse(cleanJSON(text));
  } catch (error: any) {
    console.error("Outfit Generation Error:", error);
    throw new Error(error.message || "Failed to generate outfit.");
  }
};

export const generateOutfitImage = async (): Promise<string | null> => {
  return null;
};
