export const env = {
    PORT: Number(process.env.PORT) || 3000,
    NATS_SERVER_URL: (process.env.NATS_SERVER_URL || '').trim() || `http://nats:4222`
};