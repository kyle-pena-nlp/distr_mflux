import { z, ZodType } from "zod";
import { Hono, type Context } from "hono";
import { env } from "./env.ts";
import { connect, StringCodec } from "nats";
/*
const nats_server_url = `http://nats:${env.NATS_SERVER_PORT}`;
console.log(nats_server_url);
const nc = await connect({ servers: nats_server_url });
const sc = StringCodec();
const sub = nc.subscribe("hello");


(async () => {
  for await (const m of sub) {
    console.log(`[${sub.getProcessed()}]: ${sc.decode(m.data)}`);
  }
  console.log("subscription closed");
})();

nc.publish("hello", sc.encode("hello"));
nc.publish("hello", sc.encode("world2"));

await nc.drain();
*/
const app = new Hono();

app.get('/imageGenPrompt', async (c) => {
  // applesauce
  const prompt = await readImageGenPromptFromRequest(c);
  const response = await fetch("http://nats:8222/routez");
  return c.text(prompt + " " + (await response.text()));  
});


// TODO: schema validation
async function readImageGenPromptFromRequest(c : Context) : Promise<string> {
  const request = (await c.req.json().catch(e => null)) || c.req.query()
  return request.prompt;
}

console.log(`Starting server on port ${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch
};