import asyncio, uuid, json
from argparse import ArgumentParser
from io import BytesIO
from typing import Dict
from PIL import Image
from mflux import Config, Flux1, ModelConfig
import nats
from nats.aio.msg import Msg
from nats.errors import ConnectionClosedError, NoServersError

async def main(cli_args):

    I_AM_BUSY = False

    # This is how the worker identifies itself to the server
    worker_id = cli_args.worker_id or uuid.uuid4()
    print(f"Worker {id} spun up...")

    # Connect to the NATs server
    nc = await nats.connect(cli_args.nats_server_address)

    # This code invokes mflux to satisfy a request for an image
    async def generate_and_send_image(msg : Msg):

        nonlocal I_AM_BUSY
        I_AM_BUSY = True

        print("Generating image.")

        # Deserialize message
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
            await nc.publish(msg.reply, b'', headers = dict(success = 'false'))
        
        finally:
            await nc.flush()
            I_AM_BUSY = False

    # Respond to requests for one's efforts by identifying yourself, and indicating if you are willing to accept the assignment in the header
    requestSub = await nc.subscribe('request-worker', 'workers')
    async for msg in requestSub.messages:
        await nc.publish(msg.reply, reply = worker_id, header = dict(accepts=str(not I_AM_BUSY).lower()))

    # Respond to the actual image generation request by performing it
    imgGenPayloadSub = await nc.subscribe(worker_id)
    async for msg in imgGenPayloadSub.messages:
        await generate_and_send_image(msg)

    input("Press [Enter] to close worker and exit: ")

    # Remove interest in subscription
    await requestSub.unsubscribe()
    await imgGenPayloadSub.unsubscribe()

    # Terminate connection, waiting for all current processing to complete
    await nc.drain()


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