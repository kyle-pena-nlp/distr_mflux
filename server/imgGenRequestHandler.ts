import { Hono } from "hono";
import { env } from "./env.ts";
import { connect, MsgHdrsImpl, NatsError, StringCodec, type Msg } from "nats";
import { type GenImgRequest } from "./coms";
import { recordImgGenRequest } from "./db";
import { nc } from "./nats";

const MAX_ACQUIRE_VOLUNTEER_ATTEMPTS = 10;

export async function handleImgGenRequest(m : Msg) {
    
    // Deserialize the image generation request payload from the consumer and record it for posterity
    const genImgRequest = deserializeImageGenRequest(m);
    await recordImgGenRequest(genImgRequest);

    // Try to acquire a worker from the pool
    let willingWorker : Msg|null = await getAWillingWorker();

    // If we failed to acquire a worker, early-out (TODO: tell the consumer)
    if (willingWorker == null) {
        return;
    }

    // Get the `imageInbox` that the worker will send the generated image to (the consumer is sub'd to this inbox - that's how they get the generated image)
    const imageInbox = getImageInbox(m);

    // As a server, we'll subscribe to the image inbox too.  That's how we will do logging / instrumentation / etc.
    nc.subscribe(imageInbox, {
        callback: postImageGenerationCallback
    });    
    
    // Fire off the image generation request to the selected worker
    nc.publish(willingWorker.reply!!, m.data, {
        reply: imageInbox
    });
}

async function getAWillingWorker() : Promise<Msg|null> {
    // Keep asking for a worker until you get one that accepts the work and one that's "good" (good means "trustworthy")
    let worker : Msg|null = null, attempts = 0;
    while (worker == null && attempts < MAX_ACQUIRE_VOLUNTEER_ATTEMPTS) {
        worker = await nc.request('request-worker', "", {
            timeout: 1.0
        });
        const workerAcceptsWork = (worker.headers?.get('accepts') !== 'true');
        const canUseWorker = workerAcceptsWork || !(await isTrustworthyWorker(worker));
        if (!canUseWorker) {
            worker = null;
        }
        attempts += 1;
    }
    return worker;
}

async function isTrustworthyWorker(worker : Msg) : Promise<boolean> {
    // stubbed - will reference a blacklist in the future
    return true;
}

function postImageGenerationCallback(err : NatsError | null, msg : Msg) {
    const successful = wasImageGenerationSuccessful(err,msg);
}

function deserializeImageGenRequest(m : Msg) : GenImgRequest {
    const sc = StringCodec();
    const genImgRequest = JSON.parse(sc.decode(m.data)) as GenImgRequest;
    return genImgRequest;
}

function wasImageGenerationSuccessful(err : NatsError | null, msg : Msg) : boolean {
    if (err != null) {
        return false;
    }
    const success = !!(msg.headers?.get('success'));
    if (!success) {
        return false;
    }
    return true;
}

function getImageInbox(m : Msg) : string {
    return (m.headers ?? new MsgHdrsImpl()).get('imageInbox');
}