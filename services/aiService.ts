
import { GoogleGenAI, Type } from "@google/genai";
import { StockAssetVariation, GeneratorConfig } from "../types";

/**
 * Generates stock assets using OpenAI GPT-4o
 * Activated if the API key starts with 'sk-'
 */
async function generateWithOpenAI(apiKey: string, config: GeneratorConfig): Promise<any[]> {
  const { niche, temperature, quantity } = config;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a Stock Photography SEO Expert. Generate high-quality titles, descriptions, exactly 40 keywords, and highly detailed AI prompts. Return a JSON object with a 'variations' array." 
        },
        { 
          role: "user", 
          content: `Generate ${quantity} unique variations for the niche: "${niche}". JSON format: { "variations": [ { "variationIndex": 1, "title": "...", "description": "...", "keywords": "...", "imagePrompt": "..." } ] }` 
        }
      ],
      temperature: temperature,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `OpenAI API Error: ${response.status}`);
  }

  const data = await response.json();
  try {
    const content = JSON.parse(data.choices[0].message.content);
    return content.variations || [];
  } catch (e) {
    throw new Error("Failed to parse OpenAI JSON response.");
  }
}

/**
 * Generates stock assets using Google Gemini 3 Flash
 * Adhering strictly to @google/genai SDK guidelines
 */
async function generateWithGemini(apiKey: string, config: GeneratorConfig): Promise<any[]> {
  const ai = new GoogleGenAI({ apiKey });
  const { niche, temperature, quantity } = config;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate ${quantity} unique variations of stock photo metadata for the niche: "${niche}". Focus on high commercial value and professional SEO standards.`,
      config: {
        temperature: temperature,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  variationIndex: { type: Type.INTEGER },
                  title: { type: Type.STRING, description: "SEO Title (Agency optimized, max 70 chars)" },
                  description: { type: Type.STRING, description: "Detailed description (150-200 chars)" },
                  keywords: { type: Type.STRING, description: "Exactly 40 relevant tags, comma-separated" },
                  imagePrompt: { type: Type.STRING, description: "Highly detailed AI image generation prompt including style, lighting, and composition" },
                },
                required: ["variationIndex", "title", "description", "keywords", "imagePrompt"],
              },
            },
          },
          required: ["variations"],
        },
        systemInstruction: "You are a world-class Stock Photography SEO Expert. Your mission is to generate professional titles, descriptions, exactly 40 keywords, and highly detailed AI prompts that maximize sales on platforms like Adobe Stock. Output must be valid JSON.",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini AI engine.");
    
    const parsed = JSON.parse(text);
    return parsed.variations || [];
  } catch (err: any) {
    if (err.message?.includes("403") || err.message?.includes("API_KEY_INVALID")) {
      throw new Error("Invalid Gemini API Key. Please verify your API_KEY environment variable.");
    }
    throw err;
  }
}

export const generateStockAssets = async (config: GeneratorConfig): Promise<StockAssetVariation[]> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("API_KEY is missing. Ensure the 'API_KEY' environment variable is correctly configured.");
  }

  try {
    let rawVariations: any[] = [];
    
    // Auto-detect Provider based on prefix (sk- is OpenAI, others are treated as Gemini)
    if (apiKey.startsWith('sk-')) {
      rawVariations = await generateWithOpenAI(apiKey, config);
    } else {
      rawVariations = await generateWithGemini(apiKey, config);
    }

    const { assets } = config;
    return rawVariations.map((item: any, idx: number) => ({
      id: crypto.randomUUID(),
      variationIndex: item.variationIndex || (idx + 1),
      title: assets.title ? item.title : undefined,
      description: assets.description ? item.description : undefined,
      keywords: assets.keywords ? item.keywords : undefined,
      imagePrompt: assets.prompt ? item.imagePrompt : undefined,
    }));
  } catch (err: any) {
    console.error("AI Generation Failed:", err);
    throw new Error(err.message || "An error occurred during metadata generation.");
  }
};
