import { MsgHdrsImpl, NatsError, StringCodec, type Msg } from "nats";
import { type GenImgRequest } from "./coms";

export function deserializeImageGenRequest(m : Msg) : Omit<GenImgRequest,'seed'> {
    const sc = StringCodec();
    const genImgRequest = JSON.parse(sc.decode(m.data)) as Omit<GenImgRequest,'seed'>;
    return genImgRequest;
}

export function serializeImageGenRequest(imgGenRequest : GenImgRequest) : Uint8Array {
    const sc = StringCodec();
    const stringified = JSON.stringify(imgGenRequest);
    return sc.encode(stringified);
}

export function wasImageGenerationSuccessful(err : NatsError | null, msg : Msg) : boolean {
    if (err != null) {
        return false;
    }
    const success = !!(msg.headers?.get('success'));
    if (!success) {
        return false;
    }
    return true;
}

export function getImageInbox(m : Msg) : string {
    return (m.headers ?? new MsgHdrsImpl()).get('imageInbox');
}