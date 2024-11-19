import { MsgHdrsImpl, NatsError, StringCodec, type Msg } from "nats";
import { type GenImgRequest } from "./coms";

export function deserializeImageGenRequest(m : Msg) : GenImgRequest {
    const sc = StringCodec();
    const genImgRequest = JSON.parse(sc.decode(m.data)) as GenImgRequest;
    return genImgRequest;
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