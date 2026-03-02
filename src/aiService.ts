import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_OPEN_API;

const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Required for frontend-only demo
});

export const processAIQuery = async (query: string, currentState: any) => {
    if (!apiKey) {
        throw new Error('OpenAI API Key is missing in .env');
    }

    const systemPrompt = `
You are a smart Real Estate Assistant. Your goal is to help users find properties and check weather.

### CURRENT SESSION STATE:
${JSON.stringify(currentState, null, 2)}

### YOUR TASKS:
1.  **Extract Entities**: Look for property_type (Apartment, Villa, Studio), city, state, min_price, max_price, and bedrooms.
2.  **State Management**: Update the state based on new information.
3.  **Mandatory Logic**: 
    - You MUST have a 'property_type' and 'city' before searching the database.
    - If 'property_type' is missing, ASK for it.
    - If 'city' is missing, ASK for it.
4.  **Weather Tool**: If the user asks about weather, you MUST return "TOOL_CALL: WEATHER".
5.  **Search Tool**: If property_type and city are present, you MUST return "TOOL_CALL: DATABASE".

### RESPONSE FORMAT (JSON ONLY):
{
  "updatedState": { ... },
  "message": "Friendly conversational response",
  "nextTool": "WEATHER" | "DATABASE" | "NONE"
}
`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: query }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        return JSON.parse(content || '{}');
    } catch (error) {
        console.error("AI Error:", error);
        throw error;
    }
};
