import asyncio, uuid, json, signal
from argparse import ArgumentParser
from io import BytesIO
from typing import Dict
from PIL import Image
from mflux import Config, Flux1, ModelConfig
import nats
from nats.aio.msg import Msg
from nats.errors import ConnectionClosedError, NoServersError
from contextlib import redirect_stdout

async def main(cli_args):

    # This is how the worker identifies itself to the server
    worker_id = cli_args.worker_id or str(uuid.uuid4())

    # Mark worker as busy when it is performing work so that it refuses new work if asked while busy
    I_AM_BUSY = False

    # Helpful to know
    async def disconnected_cb():
        print("Got disconnected...")

    # Helpful to know
    async def reconnected_cb():
        print("Got reconnected...")

    # Connect to the NATs server
    nc = await nats.connect(cli_args.nats_server_address, 
                            reconnected_cb=reconnected_cb,
                            disconnected_cb=disconnected_cb,
                            max_reconnect_attempts=-1)
    print(f"Worker {worker_id} is connected to NATs")

    # (callback) When image generation parameters are received from the server, this receives them and generates the image
    async def generate_and_send_image(msg : Msg):

        # The worker is occupied with generating an image and will not accept other work
        nonlocal I_AM_BUSY
        if I_AM_BUSY:
            # This shouldn't happen because of the way the worker is written
            print("Worker refused new image generation request while worker was already busy")
            await nc.publish(msg.reply, b'The worker was already busy.', headers = dict(success = 'false'))
            await nc.flush()
        I_AM_BUSY = True



        # This is where we will send the completed image to
        image_inbox = msg.reply

        # Deserialize image gen request
        request = json.loads(msg.data.decode())        

        # Every time there's a 'tic' in the mflux progress loop, broadcast progress to whoever is listening
        async def progress_cb(progress):
            await nc.publish(f"{image_inbox}.worker-progress", str(progress).encode())
            await nc.flush()
        
        try:
            # Use mflux to generate an image conforming to the request            
            image : Image = await generate_image(request, progress_cb)
            
            # Turn it into bytes
            img_io = BytesIO()
            image.save(img_io, 'PNG')
            img_io.seek(0)

            # Send the image back to the `reply` (which is an inbox that the consumer and server are sub'd to)
            await nc.publish(image_inbox, img_io.read(), headers=dict(mimetype='image/png', success='true'))
            await nc.flush()
            print("Image generation complete.")
        
        except Exception as e:
            print(str(e))
            # In case of failure, report failure (server also gets this response and can retry if desired)
            await nc.publish(image_inbox, b'There was a problem generating the image.', headers = dict(success = 'false'))
            await nc.flush()
            print("Image generation failed.")
        finally:
            # After this block of code, the worker is no longer busy, regardless of success or failure
            I_AM_BUSY = False

    # Respond to a request from the server for a worker, indicating whether you are willing to work
    # NOTE: This subscription is a "queue group" 
    # This puts the worker in a pool so only one randomly selected worker from the pool will respond to the request-worker subject
    requestSub = await nc.subscribe('request-worker', 'workers')
    print(f"Listening for requests for work...")

    # This is the channel that work requests specific to this worker are received on
    imgGenPayloadSub = await nc.subscribe(worker_id)    
    await nc.flush()
    
    # Async loop to handle the server asking this worker to volunteer to work.
    async def handle_requests():
        async for msg in requestSub.messages:
            willing = str(not I_AM_BUSY).lower()
            print("Willing to accept work from server" if willing == 'true' else "Refused work request from server")
            await nc.publish(msg.reply, reply=worker_id, headers=dict(willing=willing, workerId=worker_id))
            await nc.flush()

    # Async loop to receive the specific parameters of the work request.
    async def handle_image_generation():
        async for msg in imgGenPayloadSub.messages:
            print(f"Image generation parameters received.")
            await generate_and_send_image(msg)

    # Run both loops concurrently
    await asyncio.gather(
        handle_requests(),
        handle_image_generation()
    )

    input("Press [ENTER] at any time to close the worker.")
    print("Unsubscribing.")
    await requestSub.unsubscribe()
    await imgGenPayloadSub.unsubscribe()

    # Terminate connection, waiting for all current processing to complete
    try:
        print("Draining.")
        await nc.drain()
    except:
        pass


async def generate_image(request : Dict[str,any], progress_cb) -> Image:

    flux = Flux1(
        model_config=ModelConfig.from_alias('schnell'),
        quantize=8
    )

    try:
        # Generate an image
        image = await flux.generate_image(
            seed=request["seed"],
            prompt=request["prompt"],
            config=Config(
                num_inference_steps=request["numSteps"],
                height=request["height"],
                width=request["width"]
            ),
            progress_cb = progress_cb
        )

        # Save the image
        pil_img = image.image
        return pil_img
    except Exception as e:
        print(str(e))
        return None

if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--nats_server_address", type = str, default = "nats://localhost:4223")
    parser.add_argument("--worker_id", type = str, default = None)
    cli_args = parser.parse_args()
    asyncio.run(main(cli_args))