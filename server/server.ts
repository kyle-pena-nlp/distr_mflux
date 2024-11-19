import { z, ZodType } from "zod";
import { Hono, type Context } from "hono";
import { env } from "./env.ts";
import { connect, MsgHdrsImpl, NatsError, StringCodec, type Msg, type Payload } from "nats";

type GenImgRequest = {
    prompt : string
    seed : number
    numSteps : number 
    height : number 
    width : number 
    imageInbox : string
};

function workerGeneratedImageCallback(err : NatsError | null, msg : Msg) {
    console.log("Worked generated image.")
}

function logReturn<T>(x : T) : T {
    console.log(x);
    return x;
}

function deserializeImageGenRequest(m : Msg) : GenImgRequest {
    const sc = StringCodec();
    const genImgRequest = logReturn(JSON.parse(sc.decode(m.data)) as GenImgRequest);
    return genImgRequest;
}

async function processImgGenRequest(m : Msg) {

    nc.publish(m.reply!!, 'ack');

    const imageInbox = (m.headers ?? new MsgHdrsImpl()).get('imageInbox');
    
    // register interest in the generated image returned from the worker
    /*
    const genImgRequest = deserializeImageGenRequest(m);
    nc.subscribe(imageInbox, {
        callback: workerGeneratedImageCallback
    });*/
    
    // forward the request to the workers queue, but make the `reply` field the original consumer
    // (that way, the generated image is sent directly to the consumer, avoiding an unnecessary roundtrip)
    nc.publish('img-gen-to-workers', m.data, {
        reply: imageInbox
    })
}

// Connect to the NATs server, subscribe to img-gen requests from consumers
console.log(`Connecting to NATs server: ${env.NATS_SERVER_URL}`);
const nc = await connect({ servers: env.NATS_SERVER_URL });
const sub = nc.subscribe('img-gen');

(async () => {
    for await (const m of sub) {
        // deliberate lack of await in order to avoid blocking on received request
        processImgGenRequest(m)
    }
    console.log("subscription closed");
})();