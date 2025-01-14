const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000; // Use Railway's dynamic port or fallback to 3000

// Middleware
app.use(cors());
app.use(express.json());

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY environment variable.");
    process.exit(1); // Exit the app if critical env variables are missing
}

// Initialize OpenAI configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for AI responses
const SYSTEM_PROMPT = `You are a customer service representative named Santosh from Amazone. Instructions:
1. Be polite and professional
2. First acknowledge the customer's concern
3. Provide helpful solutions
4. Be short and precise`;

// TTS function using OpenAI
async function synthesizeSpeech(text) {
    try {
        console.log("Generating speech for:", text);
        const response = await axios({
            method: "post",
            url: "https://api.openai.com/v1/audio/speech",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            data: {
                model: "tts-1",
                input: text,
                voice: "echo",
                response_format: "mp3",
            },
            responseType: "arraybuffer",
        });

        console.log("Speech generated successfully");
        const audioBase64 = Buffer.from(response.data).toString("base64");
        return audioBase64;
    } catch (error) {
        console.error("TTS Error:", error.message);
        throw error;
    }
}

// Main endpoint for text processing
app.post("/send-text", async (req, res) => {
    const { text } = req.body;
    console.log("\n--------------------");
    console.log("Received text:", text);

    if (!text) {
        console.log("No text provided");
        return res.status(400).json({ error: "No text provided" });
    }

    try {
        // Calculate appropriate max_tokens based on input length
        const inputLength = text.length;
        const maxTokens = Math.min(Math.max(inputLength * 2, 100), 500);

        console.log("Getting AI response...");
        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: text },
            ],
            temperature: 0.7,
            max_tokens: maxTokens,
            presence_penalty: 0.6,
            frequency_penalty: 0.5,
        });

        const aiResponse = response.data.choices[0].message.content;
        console.log("AI Response:", aiResponse);

        // Generate speech
        console.log("Converting to speech...");
        const audioBase64 = await synthesizeSpeech(aiResponse);

        // Send response
        console.log("Sending response to frontend");
        res.json({
            aiResponse: aiResponse,
            audio: audioBase64,
        });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({
            error: "Error processing request",
            details: error.message,
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Ready to process requests");
});
