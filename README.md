# MERGPT

Asistente de IA con chat en tiempo real (HTML, CSS y JavaScript + backend Node.js/Express).

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
   - Copia `mergpt/.env.example` a `mergpt/.env`
   - Abre `mergpt/.env` y pega tu clave de Groq en `GROQ_API_KEY`

4. Inicia el servidor:
   ```
   npm start
   ```

5. Abre el navegador en: http://localhost:3000

## Nota

La interfaz también se puede abrir como archivo HTML directo (`mergpt/public/index.html`), pero el servidor debe estar corriendo para que el chat funcione.
