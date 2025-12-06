import { 
  GoogleGenerativeAI, 
  SchemaType, 
  HarmCategory, 
  HarmBlockThreshold 
} from "@google/generative-ai";

import { 
  UserProfile, 
  WardrobeItem, 
  OutfitRecommendation, 
  SkinTone 
} from "../types";

// ------------------------------------------------------------
// HARD-CODED KEY FIX
// Cloud Run will NOT pass Vite variables at build time.
// import.meta.env.VITE_GEMINI_API_KEY will ALWAYS be "" there.
// So we hardcode to guarantee functionality.
// ------------------------------------------------------------

const API_KEY = "AIzaSyAoUR5Hom7FrLBZTfHb4tla8XcljuTW8uE";   // <--- REPLACE THIS

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(API_KEY);

// JSON sanitizer
const cleanJSON = (text: string): string => {
  return text.replace(/```json\s*|\s*```/g, "").trim();
};

// Convert base64 → Gemini inlineData
const fileToPart = (base64Data: string, mimeType: string) => {
  const base64Content = base64Data.split(',')[1] || base64Data;
  return {
    inlineData: {
      data: base64Content,
      mimeType
    }
  };
};

// Required to allow images of people
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/* ------------------------------------------------------------------
   Analyze User Profile From Image
-------------------------------------------------------------------*/
export const analyzeUserProfileFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Partial<UserProfile>> => {

  if (!API_KEY) {
    throw new Error("API Key missing. Insert key in geminiService.ts.");
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings
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
    required: ["gender", "estimatedHeightCm", "estimatedWeightKg", "skinTone", "facialFeatures"]
  };

  const prompt = 
    "Analyze this person's physical attributes for a fashion styling app. " +
    "Estimate gender, height (cm), weight (kg), skin tone, and describe facial features. Return JSON.";

  try {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          fileToPart(base64Image, mimeType),
          { text: prompt }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = result.response.text();
    const data = JSON.parse(cleanJSON(text));

    return {
      gender: data.gender,
      heightCm: data.estimatedHeightCm,
      weightKg: data.estimatedWeightKg,
      skinTone: data.skinTone as SkinTone,
      facialFeatures: data.facialFeatures
    };

  } catch (error: any) {
    console.error("Profile Analysis Error:", error);
    throw new Error(error.message || "Failed to analyze profile image.");
  }
};

/* ------------------------------------------------------------------
   Analyze Wardrobe Items
-------------------------------------------------------------------*/
export const analyzeWardrobeFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<WardrobeItem[]> => {

  if (!API_KEY) throw new Error("API Key missing.");

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings
  });

  const schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        color: { type: SchemaType.STRING }
      },
      required: ["name", "category", "color"]
    }
  };

  const prompt = "Identify all clothing items. Return name, category, color as JSON array.";

  try {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          fileToPart(base64Image, mimeType),
          { text: prompt }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = result.response.text();
    const items = JSON.parse(cleanJSON(text));

    return items.map((item: any) => ({
      id: Math.random().toString(36).substring(2, 9),
      ...item
    }));

  } catch (error) {
    console.error("Wardrobe Analysis Error:", error);
    throw new Error("Wardrobe analysis failed.");
  }
};

/* ------------------------------------------------------------------
   Generate Outfit
-------------------------------------------------------------------*/
export const generateOutfit = async (
  profile: UserProfile,
  wardrobe: WardrobeItem[],
  occasion: string
): Promise<OutfitRecommendation> => {

  if (!API_KEY) throw new Error("API Key missing.");

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    safetySettings
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
    required: ["name", "description", "color", "source", "reasoning"]
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
      overallVibe: { type: SchemaType.STRING }
    },
    required: [
      "top", "bottom", "shoes", "accessory", "hairstyle",
      "hairstyleReasoning", "confidenceTip", "overallVibe"
    ]
  };

  const wardrobeList = wardrobe
    .map(w => `- ${w.color} ${w.name} (${w.category})`)
    .join("\n");

  const prompt = `
    User Profile: ${profile.gender}, ${profile.heightCm}cm, ${profile.weightKg}kg, ${profile.skinTone}, ${profile.facialFeatures}
    Occasion: "${occasion}"
    Wardrobe:
    ${wardrobeList}

    Create a complete outfit. Prioritize existing wardrobe. Return JSON.
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const text = result.response.text();
    return JSON.parse(cleanJSON(text));

  } catch (error) {
    console.error("Outfit Generation Error:", error);
    throw new Error("Failed to generate outfit.");
  }
};

export const generateOutfitImage = async (): Promise<string | null> => {
  return null;
};
