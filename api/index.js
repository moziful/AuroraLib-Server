// api/index.js – Vercel serverless wrapper
const serverless = require('serverless-http');
const app = require('..\index.js'); // import the existing Express app
module.exports = serverless(app);
