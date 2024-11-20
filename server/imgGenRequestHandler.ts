import { headers, NatsError, type Msg } from "nats";
import { isTrustworthyWorker, recordImgGenRequest as recordImgGenRequest, updateImgGenRequestRecord } from "./db";
import { nc } from "./nats";
import { deserializeImageGenRequest, getImageInbox as getImageInboxFromMsgHeader, serializeImageGenRequest, wasImageGenerationSuccessful } from "./imgGenRequest";

const MAX_ACQUIRE_WORKER_ATTEMPTS = 10;

export async function handleImgGenRequest(m : Msg) {
    
    // This is where the worker will eventually send the image to - the requester is sub'd to this imageInbox
    const requester_id = m.reply;
    const imageInbox = getImageInboxFromMsgHeader(m);  

    // Deserialize the image generation request and pick a random seed (server chooses the seed to avoid sybils during verification)
    const seed = Math.floor(Math.random() * (Math.pow(2,16)-1));
    const imgGenRequest = { ...deserializeImageGenRequest(m), seed };

    // Persist the image generation request
    const dbID = await recordImgGenRequest(imageInbox, imgGenRequest);

    // Acquire a non-busy ("willing") worker from the pool
    console.info(`Acquiring a willing worker from the pool`);
    const willingWorker : Msg|null = await getAWillingWorker();
    
    // If we failed to acquire a willing worker, notify the consumer and early-out
    if (willingWorker == null) {
        console.info(`Notifying requester at imageInbox ${imageInbox} that no workers are available`);
        await sendFailedImgGen(imageInbox, "There are no workers available");
        await updateImgGenRequestRecord(dbID, { successful: false });
        return;
    }

    // Otherwise, update - indicating a worker has been selected
    const workerId = willingWorker.reply!!;
    console.info(`Worker ${workerId} selected for imageInbox ${imageInbox}`);
    await updateImgGenRequestRecord(dbID, { workerId });
    await nc.publish(`${imageInbox}.worker-assigned`, workerId)

    // As the server we will subscribe to the image generation being completed so we can update records (see callback implementation)
    console.info(`Subscribing to imageInbox ${imageInbox}`);
    nc.subscribe(imageInbox, {
        callback: async (err,msg) => postImageGenerationCallback(dbID,err,msg)
    });    
    
    // Fire off the image generation request to the selected worker, with the reply pointing to the imageInbox
    console.info(`Publishing image gen request to ${workerId}`);
    nc.publish(workerId, serializeImageGenRequest(imgGenRequest), {
        reply: imageInbox
    });

    // When the worker completes the image, it will send it to the reply (imageInbox), 
    // and therefore the requester will get the image.
}

async function sendFailedImgGen(imageInbox : string, errorMessage: string) { 
    const h = headers();
    h.append('success', 'false');
    nc.publish(imageInbox, errorMessage, {
        headers: h
    });
    return;
}

async function getAWillingWorker() : Promise<Msg|null> {
    // Keep asking for a worker until you get one that is willing to accept the work and one that's not blacklisted
    let attempts = 0;
    while (attempts < MAX_ACQUIRE_WORKER_ATTEMPTS) {
        attempts += 1;
        const worker = await nc.request('request-worker', "").catch(r => transformWorkerError(r));
        if (isWorker(worker) && isWilling(worker) && (await isTrustworthy(worker))) {
            return worker;
        }
    }
    return null;
}

function transformWorkerError(r : any) {
    if (r instanceof NatsError) {
        if (r.code === '503') {
            return 'no-workers-available';
        }
        else if (r.name === 'TIMEOUT') {
            return 'timeout';
        }
    }
    console.log(r);
    return 'other-error';
}

function isWorker(x : Msg|string) : x is Msg {
    return typeof x !== 'string';
}

function isWilling(x : Msg) : boolean {
    return x.headers?.get('willing') === 'true';
}

async function isTrustworthy(x : Msg) : Promise<boolean> {
    return await isTrustworthyWorker(x.subject);
}

async function postImageGenerationCallback(dbID : number, err : NatsError | null, msg : Msg) {
    const successful = wasImageGenerationSuccessful(err,msg);
    await updateImgGenRequestRecord(dbID, { successful, end: new Date(Date.now()) });
}