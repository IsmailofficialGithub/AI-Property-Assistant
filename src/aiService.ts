export const processAIQuery = async (query: string, currentState: any) => {
    const webhookUrl = import.meta.env.VITE_MESSAGE_SEND_WEBHOOK_URL;

    if (!webhookUrl) {
        throw new Error('Webhook URL (VITE_MESSAGE_SEND_WEBHOOK_URL) is missing in .env');
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                currentState
            })
        });

        if (!response.ok) {
            throw new Error(`Webhook error: ${response.status} - ${response.statusText}`);
        }

        const text = await response.text();
        if (text) {
            try {
                const parsed = JSON.parse(text);

                // Ensure we return the expected structure even if the webhook returns something different
                const isArray = Array.isArray(parsed);

                return {
                    message: parsed.message || parsed.response || (isArray ? "I found several properties that match your search:" : (typeof parsed === 'string' ? parsed : JSON.stringify(parsed))),
                    updatedState: parsed.updatedState || (isArray ? currentState : currentState),
                    nextTool: parsed.nextTool || (isArray ? "NONE" : "NONE"),
                    data: isArray ? parsed : (parsed.data || null)
                };
            } catch (e) {
                console.error("Failed to parse webhook JSON response, returning raw text as message", e);
                return {
                    message: text,
                    data: null,
                    updatedState: currentState,
                    nextTool: "NONE"
                };
            }
        }

        return {
            message: "No response from webhook",
            data: null,
            updatedState: currentState,
            nextTool: "NONE"
        };
    } catch (error) {
        console.error("Webhook Error:", error);
        throw error;
    }
};
