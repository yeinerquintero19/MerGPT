// Vercel exige que la función serverless esté en la carpeta api/.
// Aquí solo se exporta la app de Express definida en backend/server.js.
module.exports = require("../backend/server");
