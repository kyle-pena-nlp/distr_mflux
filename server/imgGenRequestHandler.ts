import { headers, NatsError, type Msg } from "nats";
import { isTrustworthyWorker, recordImgGenRequest as recordImgGenRequest, updateImgGenRequestRecord } from "./db";
import { nc } from "./nats";
import { getImageInbox as getImageInboxFromMsgHeader, wasImageGenerationSuccessful } from "./imgGenRequest";

const MAX_ACQUIRE_VOLUNTEER_ATTEMPTS = 10;

export async function handleImgGenRequest(m : Msg) {
    
    // This is where the worker will eventually send the image to
    const imageInbox = getImageInboxFromMsgHeader(m);  

    // Record the incoming image generation request payload
    const dbID = await recordImgGenRequest(m);

    // Try to acquire a worker from the pool
    let willingWorker : Msg|null = await getAWillingWorker();
    
    // If we failed to acquire a willing worker, notify the consumer and early-out
    if (willingWorker == null) {
        await sendFailedImgGen(imageInbox, "There are no workers available");
        await updateImgGenRequestRecord(dbID, { successful: false });
        return;
    }

    // Otherwise, update - indicating a worker has been accepted
    const workerId = willingWorker.reply!!;
    await updateImgGenRequestRecord(dbID, { workerId })
    

    // As the server we will subscribe to the completed image being sent to the imageInbox
    nc.subscribe(imageInbox, {
        callback: async (err,msg) => postImageGenerationCallback(dbID,err,msg)
    });    
    
    // Fire off the image generation request to the selected worker, with the reply pointing to the imageInbox
    nc.publish(willingWorker.reply!!, m.data, {
        reply: imageInbox
    });
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
    let worker : Msg|null = null, attempts = 0;
    while (worker == null && attempts < MAX_ACQUIRE_VOLUNTEER_ATTEMPTS) {
        worker = await nc.request('request-worker', "", { timeout: 500 }).catch(r => {
            console.warn(r);
            return null;
        });
        const workerAcceptsWork = worker?.headers?.get('willing') === 'true';
        const canUseWorker = workerAcceptsWork || ((worker != null) && !(await isTrustworthyWorker(worker.reply!!)));
        if (!canUseWorker) {
            worker = null;
        }
        attempts += 1;
    }
    return worker;
}


async function postImageGenerationCallback(dbID : number, err : NatsError | null, msg : Msg) {
    const successful = wasImageGenerationSuccessful(err,msg);
    await updateImgGenRequestRecord(dbID, { successful, end: new Date(Date.now()) });
}