import { Hono } from "hono";
import { env } from "./env";
import { nc } from './nats';
import { handleImgGenRequest } from './imgGenRequestHandler';

// Subscribe to img-gen pubs from consumers
const sub = nc.subscribe('img-gen');

// For each img-gen request received...
(async () => {
    for await (const m of sub) {
        // Handle the request...
        // (deliberate lack of await in order to avoid blocking on received request)
        handleImgGenRequest(m)
    }
    console.log("subscription closed");
})();

// Make a Hono API for a dashboard
const app = new Hono();

// Status of client
app.get('/dashboard', async (c) => {
  // applesauce
  return c.text("Fooey")
});

console.log(`Starting Hono server on port ${env.PORT} (visit http://localhost:${env.PORT}/dashboard)`);
export default {
  port: env.PORT,
  fetch: app.fetch
};