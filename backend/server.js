const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

// Servir los archivos estáticos de la interfaz web (frontend/index.html, styles.css, script.js).
// Se intenta con __dirname (local) y con process.cwd() (Vercel), para que funcione en ambos.
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use(express.static(path.join(process.cwd(), "frontend")));

// Proveedor de IA seleccionado: 'groq' (gratis online), 'ollama' (gratis local en PC) o 'deepseek'
const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();

let clientConfig = {};
let defaultModel = "";

if (provider === "ollama") {
    clientConfig = {
        apiKey: "ollama",
        baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1"
    };
    defaultModel = process.env.OLLAMA_MODEL || "llama3.2";
} else if (provider === "groq") {
    clientConfig = {
        apiKey: process.env.GROQ_API_KEY || "dummy_key",
        baseURL: "https://api.groq.com/openai/v1"
    };
    defaultModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
} else {
    clientConfig = {
        apiKey: process.env.DEEPSEEK_API_KEY || "dummy_key",
        baseURL: "https://api.deepseek.com"
    };
    defaultModel = "deepseek-chat";
}

const client = new OpenAI(clientConfig);

// Handler principal para la API de chat
async function handleChat(req, res) {
    try {
        const activeGroqKey = process.env.GROQ_API_KEY || clientConfig.apiKey;
        if (provider === "groq" && (!activeGroqKey || activeGroqKey === "dummy_key")) {
            return res.status(400).json({
                error: "Falta configurar la variable GROQ_API_KEY en Vercel (Environment Variables).",
                reply: "Falta configurar la variable GROQ_API_KEY en Vercel."
            });
        }

        if (provider === "deepseek" && (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("TU_API_KEY"))) {
            return res.status(400).json({
                error: "Falta configurar una clave válida en DEEPSEEK_API_KEY dentro del archivo .env.",
                reply: "Falta la clave DEEPSEEK_API_KEY en el archivo .env."
            });
        }

        let messages = req.body.messages;

        // Soporte si se envía un único mensaje en req.body.message
        if (!messages && req.body.message) {
            messages = [{ role: "user", content: req.body.message }];
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "No se proporcionaron mensajes válidos."
            });
        }

        const systemMessage = {
            role: "system",
            content: "Eres MergPT, un asistente de IA inteligente, amable y conciso. Respondes de forma clara y directa en español."
        };

        const allMessages = [systemMessage, ...messages];
        let replyContent = "";

        if (provider === "groq") {
            const groqClient = new OpenAI({
                apiKey: groqApiKey,
                baseURL: "https://api.groq.com/openai/v1"
            });
            const respuesta = await groqClient.chat.completions.create({
                model: defaultModel,
                messages: allMessages
            });
            replyContent = respuesta.choices[0]?.message?.content || "Sin respuesta del modelo.";
        } else {
            const respuesta = await client.chat.completions.create({
                model: defaultModel,
                messages: allMessages
            });
            replyContent = respuesta.choices[0]?.message?.content || "Sin respuesta del modelo.";
        }

        res.json({
            reply: replyContent
        });

    } catch (error) {
        console.error(`Error al conectar con ${provider}:`, error.message || error);
        
        let errorMessage = error.message || "Hubo un error al conectar con la IA.";
        if (errorMessage.includes("402") || errorMessage.includes("Insufficient Balance")) {
            errorMessage = "Error 402: Tu cuenta no tiene saldo. Verifica tus credenciales en .env o Vercel.";
        } else if (errorMessage.includes("ECONNREFUSED") && provider === "ollama") {
            errorMessage = "No se pudo conectar a Ollama. Asegúrate de tener la aplicación Ollama instalada y abierta en tu PC.";
        } else if (error.status === 401 || errorMessage.includes("401")) {
            errorMessage = `Error 401: La clave de API de ${provider.toUpperCase()} no es válida.`;
        }

        res.status(500).json({
            error: errorMessage,
            reply: errorMessage
        });
    }
}

app.all("/api/chat", handleChat);
app.all("/chat", handleChat);

// En Vercel se exporta la app (función serverless); en local se inicia el servidor.
if (require.main === module) {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`Servidor MergPT escuchando en http://localhost:${PORT} (Proveedor: ${provider.toUpperCase()}, Modelo: ${defaultModel})`);
    });
}

module.exports = app;