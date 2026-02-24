export default () => ({
  port: parseInt(process.env.PORT || '4001', 10),
  database: {
    url: process.env.DATABASE_URL,
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
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    enabled: !!process.env.TELEGRAM_BOT_TOKEN,
    orgId: process.env.TELEGRAM_ORG_ID || '00000000-0000-0000-0000-000000000001',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@baogia.vn',
  },
  // AES-256-GCM key for encrypting org-level secrets (hex-encoded, 32 bytes)
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
});
