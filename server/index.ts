import { z, ZodType } from "zod";
import { Hono } from "hono";

const app = new Hono();

app.get('/imagePrompt', async (c) => {
  // applesauce
  const response = await fetch("http://localhost:8222/routez");
  return c.text(await response.text());
});

console.log("Starting server on port 3000");

export default {
  port: 3000,
  fetch: app.fetch
};