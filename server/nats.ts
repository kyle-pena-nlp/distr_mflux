import { env } from "./env.ts";
import { connect } from "nats";

console.log(`Connecting to NATs server: ${env.NATS_SERVER_URL}`);
export const nc = await connect({ servers: env.NATS_SERVER_URL });