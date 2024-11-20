import { PrismaClient, Prisma } from "@prisma/client";
import { deserializeImageGenRequest, getImageInbox } from "./imgGenRequest";
import type { Msg } from "nats";
import type { GenImgRequest } from "./coms";

const DB = new PrismaClient();

export async function recordImgGenRequest(imageInbox : string, imgGenRequest : GenImgRequest) : Promise<number> {
    const dbRec = await DB.imgGenRequest.create({
        data: {
            imageInbox,
            ...imgGenRequest
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
    console.log(`Checking if worker ${workerID} is trustworthy`);
    const record = await DB.blacklistedWorker.findFirst({
        where: {
            workerID: workerID
        },
        select: {
            workerID: true
        }
    });
    return record == null;
}