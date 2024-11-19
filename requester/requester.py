import asyncio, json
from argparse import ArgumentParser
from io import BytesIO
from typing import Dict
from PIL import Image
import nats
import nats.aio
from nats.aio.msg import Msg
from nats.errors import ConnectionClosedError, NoServersError
from nats.aio.subscription import Subscription
from typing import Dict

async def main(cli_args):

    nc = await nats.connect(cli_args.nats_server_address)
    subs : Dict[str,Subscription] = dict()

    # Until the user doesn't want to anymore
    while True:

        future = asyncio.Future()

        # This handles the response from the worker
        async def receive_generated_image(msg : Msg):
            nonlocal future
            success = msg.headers['success']
            if success == 'true':
                bytes_io = BytesIO(msg.data)
                img = Image.open(bytes_io)
                img.save('./image.png')
            else:
                reason = msg.data.decode()
                print(f"Image generation failed - {reason}" )
            future.set_result(True)
        
        # Ask the user for the prompt, early-out if no response
        prompt = input("Enter prompt (Empty prompt will exit program): ").strip()
        if (prompt == ''):
            break

        # Construct a one-shot inbox that receives the generated image (handled by `receive_generated_image`)
        image_inbox = nc.new_inbox()
        await nc.subscribe(image_inbox, cb = receive_generated_image, max_msgs=1)

        # Prepare the image generation request
        image_gen_opts = dict(prompt = prompt, seed = 42, numSteps = 4, height = 128, width = 128)
        payload_string = json.dumps(image_gen_opts)
        payload_bytes = payload_string.encode()
        headers = dict(imageInbox = image_inbox)

        # Send off the image generation request for immediate acknowledgment by the server 
        # (The server delegates generation to the workers queue, which then sends the generated image to the inbox)
        try:
            await nc.publish('img-gen', payload_bytes, headers = headers)
            await nc.flush()
            await asyncio.wait_for(future, timeout=None)
        except Exception as e:
            print(str(e))
        
    # Wind down
    await nc.drain()


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--nats_server_address", type = str, default = "nats://localhost:4223")
    cli_args = parser.parse_args()
    asyncio.run(main(cli_args))