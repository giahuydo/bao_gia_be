export default () => ({
  port: parseInt(process.env.PORT || '4001', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'bao_gia',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiration: process.env.JWT_EXPIRATION || '7d',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  n8n: {
    // Secret for n8n → backend API calls (X-Service-Key header)
    serviceKey: process.env.N8N_SERVICE_KEY,
    // Secret for n8n → backend webhook callbacks (X-Webhook-Secret header)
    webhookSecret: process.env.N8N_WEBHOOK_SECRET,
    // n8n base URL for backend → n8n webhook triggers
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5679',
  },
});
