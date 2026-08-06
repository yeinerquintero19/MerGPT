# MERGPT

Asistente de IA con chat en tiempo real (frontend HTML, CSS y JavaScript + backend Node.js/Express).

## Estructura del proyecto

```
mergpt/
├── frontend/            # Interfaz web (HTML, CSS, JS)
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── googled99009649db5e77a.html
├── backend/             # API y servidor
│   ├── server.js
│   ├── .env
│   └── .env.example
├── package.json
├── vercel.json
└── README.md
```

## Requisitos

- [Node.js](https://nodejs.org) (v18 o superior)
- Una clave de API de [Groq](https://console.groq.com) (gratis)

## Puesta en marcha

1. Descarga o clona el proyecto:
   ```
   git clone https://github.com/yeinerquintero19/MERGPT.git
   cd MERGPT
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea tu archivo de configuración:
   - Copia `backend/.env.example` a `backend/.env`
   - Abre `backend/.env` y pega tu clave de Groq en `GROQ_API_KEY`

4. Inicia el servidor:
   ```
   npm start
   ```

5. Abre el navegador en: http://localhost:3000

## Nota

La interfaz también se puede abrir como archivo HTML directo (`frontend/index.html`), pero el servidor debe estar corriendo para que el chat funcione.
