import { PrismaClient, Prisma } from "@prisma/client";
import { getImageInbox } from "./imgGenRequest";
import type { Msg } from "nats";

const DB = new PrismaClient();

export async function recordImgGenRequest(m : Msg) : Promise<number> {
    const imageInbox = getImageInbox(m);
    const dbRec = await DB.imgGenRequest.create({
        data: {
            imageInbox
        }
    });
    return dbRec.id;
}

export async function updateImgGenRequestRecord(dbID : number, props : Prisma.ImgGenRequestUpdateInput) {
    await DB.imgGenRequest.update({
        where: {
            id: dbID
        },
        data: props
    });
}


export async function isTrustworthyWorker(workerID : string) : Promise<boolean> {
    const record = await DB.blacklistedWorker.findFirst({
        where: {
            workerID: workerID
        },
        select: {
            workerID: true
        }
    });
    return record != null;
}