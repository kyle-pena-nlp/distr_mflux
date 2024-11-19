import asyncio, uuid, json
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

    # Mark worker as busy when it is performing work so that it refuses new work if asked
    I_AM_BUSY = False

    # This is how the worker identifies itself to the server
    worker_id = cli_args.worker_id or str(uuid.uuid4())

    async def disconnected_cb():
        print("Got disconnected...")

    async def reconnected_cb():
        print("Got reconnected...")

    # Connect to the NATs server
    nc = await nats.connect(cli_args.nats_server_address, 
                            reconnected_cb=reconnected_cb,
                            disconnected_cb=disconnected_cb,
                            max_reconnect_attempts=-1)
    print(f"Worker {worker_id} is connected to NATs")

    # This is the long-running handler for generating an image with mflux
    async def generate_and_send_image(msg : Msg):

        # The worker is occupied with generating an image and will not accept other work
        nonlocal I_AM_BUSY
        if I_AM_BUSY:
            # This shouldn't happen because of the way the worker is written
            print("Worker received image generation request while worker was already busy")
            await nc.publish(msg.reply, b'The worker was already busy.', headers = dict(success = 'false'))
            await nc.flush()
        I_AM_BUSY = True

        print("Generating image.")

        # Deserialize image gen request
        request = json.loads(msg.data.decode())
        
        try:
            # Use mflux to generate an image conforming to the request            
            image : Image = generate_image(request)
            
            # Turn it into bytes
            img_io = BytesIO()
            image.save(img_io, 'PNG')
            img_io.seek(0)

            # Send the image back to the `reply` (which is an inbox that the consumer and server are sub'd to)
            headers = dict(mimetype='image/png', success='true')
            await nc.publish(msg.reply, img_io.read(), headers=headers)
            await nc.flush()
        except Exception as e:
            # In case of failure, report failure (server also gets this response and can retry if desired)
            print(str(e))
            await nc.publish(msg.reply, b'There was a problem generating the image.', headers = dict(success = 'false'))
            await nc.flush()
        finally:
            # The worker is no longer busy
            I_AM_BUSY = False

    # Respond to a request from the server for a worker, indicating whether you are willing to work
    requestSub = await nc.subscribe('request-worker', 'workers')
    print(nc.stats)
    print(f"Subscribed to '{requestSub.subject}'")

    # Respond to an image generation request
    imgGenPayloadSub = await nc.subscribe(worker_id)    
    print(f"Subscribed to '{imgGenPayloadSub.subject}'")
    await nc.flush()
    
    async def respond_to_worker_request_loop():
        print("Listening for worker pool requests...")
        async for msg in requestSub.messages:
            willing=str(not I_AM_BUSY).lower()
            print(f"Work request received - willing={willing}")
            await nc.publish(msg.reply, reply = worker_id, header = dict(willing = willing))
            await nc.flush()

    async def perform_image_generation_work_loop():
        print("Listening for img gen requests...")
        async for msg in imgGenPayloadSub.messages:
            print(f"Image generation request received.")
            await generate_and_send_image(msg)

    async def unsubscribe():
        input("Press [ENTER] at any time to close the worker.")
        print("Unsubscribing.")
        await requestSub.unsubscribe()
        await imgGenPayloadSub.unsubscribe()

    task1 = asyncio.create_task(respond_to_worker_request_loop())
    task2 = asyncio.create_task(perform_image_generation_work_loop())
    task3 = asyncio.create_task(unsubscribe())

    print(f"Worker {worker_id} async loops started.")
    await asyncio.gather(task1, task2, task3)

    # Terminate connection, waiting for all current processing to complete
    try:
        print("Draining.")
        await nc.drain()
    except:
        pass


def generate_image(request : Dict[str,any]) -> Image:

    flux = Flux1(
        model_config=ModelConfig.from_alias('schnell'),
        quantize=8
    )

    try:
        # Generate an image
        image = flux.generate_image(
            seed=request["seed"],
            prompt=request["prompt"],
            config=Config(
                num_inference_steps=request["numSteps"],
                height=request["height"],
                width=request["width"]
            )
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