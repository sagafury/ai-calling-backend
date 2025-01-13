const express = require("express");
const app = express();
const PORT = 3000;
const cors = require("cors");
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// System prompt for AI responses
const SYSTEM_PROMPT_EN = `You are Alex, a friendly and professional sales representative. Follow these guidelines:

1. Communication Style:
   - Be natural and conversational, like a real person
   - Keep responses brief (1-2 sentences)
   - Show enthusiasm but remain professional
   - Listen carefully to customer responses
   - Adapt your tone based on customer interest

2. Conversation Flow:
   Initial Greeting:
   - Just a simple "Hello sir/ma'am, is this a convenient time to talk?"
   - Wait for their response

   If they say "No" or seem busy:
   - Be understanding
   - Politely end the call
   - Ask when would be a better time to call back

   If they say "Yes":
   - Briefly mention: "I'm calling about our new AI smartphone that's revolutionizing the market"
   - Let them guide the conversation with questions

3. When Customer Shows Interest:
   - Focus on benefits they specifically ask about
   - If they want to order:
     * Thank them warmly
     * Provide their order ID
     * Mention: "Our payment team will contact you shortly"
     * End call professionally

4. Key Points:
   - Never be pushy
   - Listen more than you speak
   - Address their concerns directly
   - Keep the conversation flowing naturally

Remember: You're having a real conversation, not reading a script.`;

const SYSTEM_PROMPT_HI = `आप अलेक्स हैं, एक मित्रवत और पेशेवर सेल्स प्रतिनिधि। इन दिशानिर्देशों का पालन करें:

1. संवाद शैली:
   - स्वाभाविक और वार्तालाप जैसा रहें
   - संक्षिप्त जवाब दें (1-2 वाक्य)
   - उत्साह दिखाएं पर पेशेवर बने रहें
   - ग्राहक की प्रतिक्रिया ध्यान से सुनें
   - ग्राहक की रुचि के अनुसार अपना लहजा बदलें

2. वार्तालाप प्रवाह:
   प्रारंभिक अभिवादन:
   - बस एक साधारण "नमस्ते सर/मैडम, क्या अभी बात करने का उचित समय है?"
   - उनकी प्रतिक्रिया का इंतजार करें

   अगर वे "नहीं" कहें या व्यस्त लगें:
   - समझदारी दिखाएं
   - विनम्रता से कॉल समाप्त करें
   - पूछें कि कब वापस कॉल करना बेहतर रहेगा

   अगर वे "हां" कहें:
   - संक्षेप में बताएं: "मैं हमारे नए AI स्मार्टफोन के बारे में बात कर रहा/रही हूं जो बाजार में क्रांति ला रहा है"
   - उनके सवालों से वार्तालाप को आगे बढ़ने दें

3. जब ग्राहक रुचि दिखाए:
   - उन्हीं फायदों पर ध्यान दें जिनके बारे में वे पूछें
   - अगर वे ऑर्डर करना चाहें:
     * हार्दिक धन्यवाद दें
     * उनका ऑर्डर ID प्रदान करें
     * बताएं: "हमारी पेमेंट टीम जल्द ही आपसे संपर्क करेगी"
     * पेशेवर तरीके से कॉल समाप्त करें

4. महत्वपूर्ण बिंदु:
   - कभी भी दबाव न डालें
   - बोलने से ज्यादा सुनें
   - उनकी चिंताओं का सीधा समाधान करें
   - वार्तालाप को स्वाभाविक रूप से बहने दें

याद रखें: आप एक वास्तविक वार्तालाप कर रहे हैं, स्क्रिप्ट नहीं पढ़ रहे।`;

app.use(cors());
app.use(express.json());

let orderCounter = 1000; // Starting order ID

const generateOrderId = () => {
    return `ORD${orderCounter++}`;
};

const INITIAL_GREETING = {
    en: "Hello {title}, is this a convenient time to talk?",
    hi: "नमस्ते {title}, क्या अभी बात करने का उचित समय है?"
};

// Main endpoint for text processing
app.post("/send-text", async (req, res) => {
    const { text, language, name, gender, conversationStarted } = req.body;
    console.log("Received request:", { text, language, name, gender, conversationStarted });

    try {
        let aiResponse;
        
        // Handle initial greeting
        if (text === 'initial_greeting') {
            const title = gender === 'male' ? 
                (language === 'hi' ? 'सर' : 'sir') : 
                (language === 'hi' ? 'मैडम' : 'ma\'am');
            aiResponse = INITIAL_GREETING[language || 'en'].replace('{title}', title);
        } else {
            // Regular conversation
            const messages = [
                { 
                    role: 'system', 
                    content: language === 'hi' ? SYSTEM_PROMPT_HI : SYSTEM_PROMPT_EN 
                },
                { 
                    role: 'user', 
                    content: `Customer Name: ${name}\nGender: ${gender}\nMessage: ${text}` 
                }
            ];

            // Check for order intent
            const orderKeywords = ['book', 'order', 'buy', 'purchase', 'want', 'take', 'interested'];
            const isOrdering = orderKeywords.some(keyword => 
                text.toLowerCase().includes(keyword)
            );

            if (isOrdering) {
                const orderId = generateOrderId();
                messages.push({
                    role: 'system',
                    content: `Customer wants to order. Generate a warm, brief response that includes Order ID: ${orderId} and naturally mention that the payment team will contact them soon.`
                });
            }

            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: messages,
                temperature: 0.8,  // Slightly increased for more natural responses
                max_tokens: 150    // Kept short for concise responses
            });

            aiResponse = completion.choices[0].message.content;
        }

        // Generate speech
        const audioResponse = await axios({
            method: 'post',
            url: 'https://api.openai.com/v1/audio/speech',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            data: {
                model: 'tts-1',
                input: aiResponse,
                voice: language === 'hi' ? 'shimmer' : 'echo',
                speed: 1.0
            },
            responseType: 'arraybuffer'
        });

        const audioBase64 = Buffer.from(audioResponse.data).toString('base64');

        res.json({
            aiResponse,
            audio: audioBase64
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ 
            error: "Error processing request",
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Ready to process requests");
});