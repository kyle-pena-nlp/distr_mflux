import { headers, NatsError, type Msg } from "nats";
import { isTrustworthyWorker, recordImgGenRequest as insertImgGenRequestRecord, updateImgGenRequestRecord } from "./db";
import { nc } from "./nats";
import { getImageInbox, wasImageGenerationSuccessful } from "./imgGenRequest";

const MAX_ACQUIRE_VOLUNTEER_ATTEMPTS = 10;

export async function handleImgGenRequest(m : Msg) {
    
    // Get the inbox that the worker will send the image to
    const imageInbox = getImageInbox(m);  

    // Deserialize the image generation request payload and record it for posterity
    await insertImgGenRequestRecord(m);  

    // Try to acquire a worker from the pool
    let willingWorker : Msg|null = await getAWillingWorker();

    
    if (willingWorker == null) {
        // If we failed to acquire a willing worker, notify the consumer and early-out
        await sendFailedImgGenToImageInbox(imageInbox);
        await updateImgGenRequestRecord(imageInbox, { successful: false });
        return;
    }
    else {
        // Otherwise, update 
        await updateImgGenRequestRecord(imageInbox, { workerId: willingWorker.reply!! })
    }

    // If we could find a worker, as the server we will *also* listen for image generation completion
    nc.subscribe(imageInbox, {
        callback: postImageGenerationCallback
    });    
    
    // Fire off the image generation request to the selected worker, with the reply pointing to the imageInbox
    nc.publish(willingWorker.reply!!, m.data, {
        reply: imageInbox
    });
}

async function sendFailedImgGenToImageInbox(imageInbox : string) { 
    const h = headers();
    h.append('success', 'false');
    await nc.publish(imageInbox, "Could not find worker in network", {
        headers: h
    });
    return;
}

async function getAWillingWorker() : Promise<Msg|null> {
    // Keep asking for a worker until you get one that accepts the work and one that's "trustworthy"
    let worker : Msg|null = null, attempts = 0;
    while (worker == null && attempts < MAX_ACQUIRE_VOLUNTEER_ATTEMPTS) {
        worker = await nc.request('request-worker', "", {
            timeout: 1.0
        });
        const workerAcceptsWork = (worker.headers?.get('accepts') !== 'true');
        const canUseWorker = workerAcceptsWork || !(await isTrustworthyWorker(worker.reply!!));
        if (!canUseWorker) {
            worker = null;
        }
        attempts += 1;
    }
    return worker;
}


async function postImageGenerationCallback(err : NatsError | null, msg : Msg) {
    const imageInbox = msg.subject;
    const successful = wasImageGenerationSuccessful(err,msg);
    if (successful) {
        await updateImgGenRequestRecord(imageInbox, { successful: true, end: new Date(Date.now()) });
    }
}