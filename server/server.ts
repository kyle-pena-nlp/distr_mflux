import { Hono } from "hono";
import { env } from "./env";
import { nc } from './nats';
import { handleImgGenRequest } from './imgGenRequestHandler';


// Subscribe to img-gen pubs from consumers
const sub = nc.subscribe('img-gen');

// For each img-gen request received (as long as the server is alive), handle the message
(async () => {
    for await (const m of sub) {
        // deliberate lack of await in order to avoid blocking on received request
        handleImgGenRequest(m)
    }
    console.log("subscription closed");
})();

// Make a Hono API
const app = new Hono();

// Status of client
app.get('/status', async (c) => {
  // applesauce
  return c.text("Fooey")
});

// List of currently connected workers
app.get('/list', async (c) => {
    // applesauce
    return c.text("fooey");
});

// Details on a worker
app.get('/details', async (c) => {
    // applesauce
    return c.text("fooey");
});

// Change a worker
app.post('/updateWorker', async (c) => {
    // applesauce
    return c.text("fooey");
});

console.log(`Starting server on port ${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch
};