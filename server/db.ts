import { PrismaClient, Prisma } from "@prisma/client";
import { type GenImgRequest } from "./coms";
import { deserializeImageGenRequest, getImageInbox } from "./imgGenRequest";
import type { Msg } from "nats";

const DB = new PrismaClient();

export async function recordImgGenRequest(m : Msg) {
    const imageInbox = getImageInbox(m);
    const rec = deserializeImageGenRequest(m);
    await DB.imgGenRequest.create({
        data: {
            imageInbox
        }
    });
}

export async function updateImgGenRequestRecord(imageInbox : string, props : Prisma.ImgGenRequestUpdateInput) {
    await DB.imgGenRequest.update({
        where: {
            imageInbox
        },
        data: props
    });
}


export async function isTrustworthyWorker(worker_id : string) : Promise<boolean> {
    // stubbed - will reference a blacklist in the future
    return true;
}