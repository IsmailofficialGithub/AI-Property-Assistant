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

                // Extract message and data more intelligently
                let message = "";
                let data = null;

                if (isArray && parsed.length > 0) {
                    const firstItem = parsed[0];
                    if (firstItem.response || firstItem.message) {
                        message = firstItem.response || firstItem.message;
                        data = null; // It's a text response, not property data
                    } else if (firstItem.property_type || firstItem.price) {
                        message = "I found several properties that match your search:";
                        data = parsed;
                    } else {
                        message = typeof firstItem === 'string' ? firstItem : JSON.stringify(parsed);
                        data = null;
                    }
                } else if (!isArray && parsed) {
                    message = parsed.message || parsed.response || (typeof parsed === 'string' ? parsed : JSON.stringify(parsed));
                    data = parsed.data || null;
                } else {
                    message = "I couldn't find any results.";
                    data = null;
                }

                return {
                    message,
                    updatedState: parsed.updatedState || (isArray ? currentState : currentState),
                    nextTool: parsed.nextTool || "NONE",
                    data: data
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
