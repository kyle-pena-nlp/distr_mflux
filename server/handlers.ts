import { z, ZodType } from "zod";
import { type Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";

type HandlerSpec<T,U> = {
    requestSchema : T
    responseSchema : U
    handler : (req: T) => Promise<U>
}
/*
export function makeRouteHandler<T extends ZodType, U extends ZodType>(spec : HandlerSpec<T,U>) : (c: Context) => Promise<ReturnType<Context['json']>> {
    return async (c) => {
        const [requestValidationSuccess,result] = await validateRequest(c, spec);
        if (!requestValidationSuccess) {
            return c.json({ statusText: result.statusText }, result.status)
        }
        const rawResponseBody = await spec.handler(result);
        return c.json(rawResponseBody);
    };
}

type RequestValidation<T extends ZodType> = [false,{ status: StatusCode, statusText: string}] | [true,z.infer<T>];

async function validateRequest<T extends ZodType, U extends ZodType>(c : Context, spec: HandlerSpec<T,U>) : Promise<RequestValidation<T>> {
      const rawRequestBody = await c.req.json().catch(e => null);
      if (rawRequestBody == null) {
        return [false,{
          status: 400,
          statusText: `Invalid or missing request JSON`
        }];
      }
      const parsedRequestBody = spec.requestSchema.safeParse(rawRequestBody);
      if (!parsedRequestBody.success) {
        return [false,{
          status: 400,
          statusText: `Invalid JSON shape for request`
        }];
      }
      return [true,parsedRequestBody.data];
}*/