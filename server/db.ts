import { PrismaClient } from "@prisma/client";
import { type GenImgRequest } from "./coms";

const DB = new PrismaClient();

export async function recordImgGenRequest(m : GenImgRequest) {

}