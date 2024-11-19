export const env = {
    PORT: Number(process.env.PORT),
    NATS_SERVER_URL: (process.env.NATS_SERVER_URL || '').trim()
};