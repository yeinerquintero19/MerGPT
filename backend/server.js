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

// Proveedor de IA seleccionado: 'openrouter' (gratis online), 'groq', 'ollama' (local) o 'deepseek'
const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase();

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
    defaultModel = process.env.GROQ_MODEL || "groq/compound";
} else if (provider === "openrouter") {
    clientConfig = {
        apiKey: process.env.OPENROUTER_API_KEY || "dummy_key",
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": "https://mergpt.vercel.app",
            "X-Title": "MerGPT"
        }
    };
    defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free";
} else {
    clientConfig = {
        apiKey: process.env.DEEPSEEK_API_KEY || "dummy_key",
        baseURL: "https://api.deepseek.com"
    };
    defaultModel = "deepseek-chat";
}

const client = new OpenAI(clientConfig);

// Función de búsqueda ultra-rápida en paralelo (Google News RSS & DuckDuckGo)
async function searchWebAndNews(query) {
    if (!query || query.length < 3) return "";
    
    // Omitir búsqueda web para saludos o frases cortas triviales
    const cleanQ = query.toLowerCase().trim();
    const trivialWords = ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "quien eres", "como te llamas", "que eres", "gracias", "chao", "adios"];
    if (trivialWords.some(w => cleanQ === w || cleanQ === w + "?" || cleanQ === w + "!")) {
        return "";
    }

    const fetchNews = async () => {
        try {
            const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=CO&ceid=CO:es-419`;
            const newsRes = await fetch(newsUrl, { 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(1500)
            });
            if (newsRes.ok) {
                const xml = await newsRes.text();
                const items = [...xml.matchAll(/<title>(.*?)<\/title>/g)]
                    .map(m => m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim())
                    .filter(t => t && !t.toLowerCase().includes('google news') && !t.toLowerCase().includes('google noticias'))
                    .slice(0, 5);
                if (items.length > 0) {
                    return "TITULARES Y NOTICIAS EN TIEMPO REAL (DE HOY):\n- " + items.join("\n- ");
                }
            }
        } catch (e) {}
        return "";
    };

    const fetchDDG = async () => {
        try {
            const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const ddgRes = await fetch(ddgUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(1500)
            });
            if (ddgRes.ok) {
                const html = await ddgRes.text();
                const snippets = [...html.matchAll(/<a class="result__snippet[^"]*"[^>]*>(.*?)<\/a>/gs)]
                    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
                    .filter(s => s.length > 15)
                    .slice(0, 3);
                if (snippets.length > 0) {
                    return "INFORMACIÓN ADICIONAL DE LA WEB:\n- " + snippets.join("\n- ");
                }
            }
        } catch (e) {}
        return "";
    };

    // Ejecutar ambas búsquedas EN PARALELO simultáneamente
    const [newsResult, ddgResult] = await Promise.allSettled([fetchNews(), fetchDDG()]);
    
    const parts = [
        newsResult.status === 'fulfilled' ? newsResult.value : '',
        ddgResult.status === 'fulfilled' ? ddgResult.value : ''
    ].filter(Boolean);

    return parts.join("\n\n");
}

// Handler principal para la API de chat
async function handleChat(req, res) {
    try {
        const groqApiKey = process.env.GROQ_API_KEY || clientConfig.apiKey;
        if (provider === "groq" && (!groqApiKey || groqApiKey === "dummy_key")) {
            return res.status(400).json({
                error: "Falta configurar la variable GROQ_API_KEY en Vercel (Environment Variables).",
                reply: "Falta configurar la variable GROQ_API_KEY en Vercel."
            });
        }

        if (provider === "openrouter" && (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === "dummy_key")) {
            return res.status(400).json({
                error: "Falta configurar la variable OPENROUTER_API_KEY en Vercel (Environment Variables).",
                reply: "Falta configurar OPENROUTER_API_KEY en Vercel. Obtén tu clave gratuita en openrouter.ai"
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

        const lastUserMsg = messages[messages.length - 1]?.content || "";
        const webInfo = await searchWebAndNews(lastUserMsg);

        const todayStr = new Date().toLocaleDateString("es-ES", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // Modificar el último mensaje del usuario para incluir la información en tiempo real
        let modifiedMessages = [...messages];
        if (webInfo && webInfo.trim()) {
            modifiedMessages[modifiedMessages.length - 1] = {
                role: "user",
                content: `[INFORMACIÓN DE ÚLTIMA HORA EN TIEMPO REAL AL DÍA DE HOY (${todayStr})]:\n${webInfo}\n\nConsulta del usuario: ${lastUserMsg}\n\n(INSTRUCCIÓN: Responde utilizando y detallando estas noticias recientes en tiempo real para informar al usuario de lo que está sucediendo HOY).`
            };
        }

        const systemMessage = {
            role: "system",
            content: `Eres MergPT, un asistente de IA inteligente, actualizado y conciso. Respondes en español basándote en información en tiempo real.\nFecha actual: ${todayStr}.`
        };

        const allMessages = [systemMessage, ...modifiedMessages];
        let replyContent = "";

        const respuesta = await client.chat.completions.create({
            model: defaultModel,
            messages: allMessages
        });
        replyContent = respuesta.choices[0]?.message?.content || "Sin respuesta del modelo.";

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

app.get("/googled99009649db5e77a.html", (req, res) => {
    res.send("google-site-verification: googled99009649db5e77a.html");
});

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