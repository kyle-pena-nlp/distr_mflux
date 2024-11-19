import asyncio, uuid, json
from argparse import ArgumentParser
from io import BytesIO
from typing import Dict
from PIL import Image
from mflux import Config, Flux1, ModelConfig
import nats
from nats.aio.msg import Msg
from nats.errors import ConnectionClosedError, NoServersError

QUEUE_GROUP = "workers"

async def main(cli_args):

    id = uuid.uuid4()
    print(f"Worker {id} spun up...")

    # Abe - this will be the port that the NATs server runs on if you spun up the server with `docker compose  up`
    nc = await nats.connect(cli_args.nats_server_address)

    async def generate_and_send_image(msg : Msg):

        print("Generating image.")

        # Deserialize message
        request = json.loads(msg.data.decode())
        
        # Generate an image conforming to the request
        image = generate_image(request)
        
        # Turn it into bytes
        img_io = BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)

        # Send image as bytes along with a mimetype header directly to the peer who requested it (server listens too in order to do instrumentation / verification requests)
        headers = dict(mimetype='image/png',success='true')

        print("Publish image")
        await nc.publish(msg.reply, img_io.read(), headers=headers)
        print("Flush")
        await nc.flush()

    # Respond to requests for image generation in the queue named 'workers'
    sub = await nc.subscribe('img-gen-to-workers', QUEUE_GROUP)
    async for msg in sub.messages:
        print("Got image gen request")
        await generate_and_send_image(msg)

    input("Press [Enter] to close worker and exit: ")

    # Remove interest in subscription
    await sub.unsubscribe()

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
    cli_args = parser.parse_args()
    asyncio.run(main(cli_args))