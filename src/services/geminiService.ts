import { GoogleGenerativeAI, SchemaType, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { UserProfile, WardrobeItem, OutfitRecommendation, SkinTone } from "../types";

// Helper to sanitize JSON
const cleanJSON = (text: string): string => {
  return text.replace(/```json\s*|\s*```/g, "").trim();
};

const fileToPart = (base64Data: string, mimeType: string) => {
  const base64Content = base64Data.split(',')[1] || base64Data;
  return {
    inlineData: {
      data: base64Content,
      mimeType
    }
  };
};

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize Client
const genAI = new GoogleGenerativeAI(API_KEY || "");

// *** CRITICAL FIX: SAFETY SETTINGS ***
// This allows the AI to analyze photos of people without blocking it as "Harmful"
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const analyzeUserProfileFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Partial<UserProfile>> => {
  
  // Debugging: Check if Key exists in the browser
  if (!API_KEY) {
    alert("Critical Error: API Key is missing. The build did not pass the variable.");
    throw new Error("API Key is missing.");
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    safetySettings: safetySettings // <--- Applied here
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

  const prompt = "Analyze this person's physical attributes for a fashion styling app. Estimate gender, height (in cm), weight (in kg), skin tone (strictly pick the closest match), and describe facial features. Return JSON.";

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
        responseSchema: schema,
      }
    });

    const text = result.response.text();
    console.log("AI Response:", text); // Debugging: See what AI says in Console (F12)
    
    const data = JSON.parse(cleanJSON(text));
    
    return {
      gender: data.gender,
      heightCm: data.estimatedHeightCm,
      weightKg: data.estimatedWeightKg,
      skinTone: data.skinTone as SkinTone,
      facialFeatures: data.facialFeatures
    };

  } catch (error: any) {
    console.error("Profile Analysis Error Full Details:", error);
    // If it's a safety block, tell the user
    if (error.message?.includes("SAFETY")) {
      throw new Error("AI blocked this image for safety reasons. Please try a different photo.");
    }
    throw new Error(error.message || "Failed to analyze image");
  }
};

export const analyzeWardrobeFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<WardrobeItem[]> => {
  if (!API_KEY) throw new Error("API Key is missing.");
  
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    safetySettings: safetySettings 
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

  const prompt = "Identify all clothing items. Provide name, category, and color. Return JSON array.";

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
        responseSchema: schema,
      }
    });

    const text = result.response.text();
    const items = JSON.parse(cleanJSON(text));
    
    return items.map((item: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      ...item
    }));

  } catch (error) {
    console.error("Wardrobe Analysis Error:", error);
    throw new Error("Could not identify items.");
  }
};

export const generateOutfit = async (
  profile: UserProfile,
  wardrobe: WardrobeItem[],
  occasion: string
): Promise<OutfitRecommendation> => {
  if (!API_KEY) throw new Error("API Key is missing.");
  
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    safetySettings: safetySettings 
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
      overallVibe: { type: SchemaType.STRING },
    },
    required: ["top", "bottom", "shoes", "accessory", "hairstyle", "hairstyleReasoning", "confidenceTip", "overallVibe"]
  };

  const wardrobeList = wardrobe.map(w => `- ${w.color} ${w.name} (${w.category})`).join("\n");

  const prompt = `
    User Profile: ${profile.gender}, ${profile.heightCm}cm, ${profile.weightKg}kg, ${profile.skinTone}, ${profile.facialFeatures}
    Occasion: "${occasion}"
    Wardrobe: ${wardrobeList}
    
    Goal: Create an outfit. Prioritize wardrobe. If missing items, suggest Shopping.
    Return JSON.
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const text = result.response.text();
    return JSON.parse(cleanJSON(text)) as OutfitRecommendation;

  } catch (error) {
    console.error("Outfit Gen Error:", error);
    throw new Error("Failed to generate outfit.");
  }
};

export const generateOutfitImage = async (): Promise<string | null> => {
  return null;
};
