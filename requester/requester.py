import asyncio, json, uuid, os
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

    # This would be tied to machine identity in a real system
    requester_id = str(uuid.uuid4())

    # In a real system this would be a list of potential servers for redundancy/rollback
    nc = await nats.connect(cli_args.nats_server_address)

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
    print(f"Worker {requester_id} is connected to NATs")    

    # Until the user doesn't want to anymore
    while True:

        # (callback) This receives the bytes of the generated image
        img_gen_future = asyncio.Future()
        async def receive_generated_image(msg : Msg):
            # We are awaiting this future before we allow the user to enter another prompt
            nonlocal img_gen_future
            # This is the imageInbox that the image was sent to
            imageInbox = msg.subject
            # But was it successful?
            success = msg.headers['success']
            if success == 'true':
                # If it was, decode it and save it
                bytes_io = BytesIO(msg.data)
                img = Image.open(bytes_io)
                img_fpath = f"./generated/{imageInbox}.png"
                img.save(img_fpath)
                print(f"Image saved to {img_fpath} (file://{os.path.abspath(img_fpath)})")
            else:
                # If it wasn't, display the reason why it wasn't.
                reason = msg.data.decode()
                print(f"Image generation failed - {reason}" )
            img_gen_future.set_result(True)

        # (callback) This displays when the server has assigned a worker to generate the image
        worker_assigned_future = asyncio.Future()
        async def notify_assigned_worker(msg : Msg):
            nonlocal worker_assigned_future
            worker_id = msg.data.decode()
            print(f"Server assigned worker ID '{worker_id}' to process image generation request")
            worker_assigned_future.set_result(True)

        # (callback) This displays when the worker posts an update on the image generation progress
        async def notify_worker_progress(msg: Msg):
            progress = float(msg.data.decode())
            print(f"{progress:.0f}% complete")
        
        # Ask the user for the prompt, early-out if no response
        prompt = input("Enter prompt (Empty prompt will exit program): ").strip()
        if (prompt == ''):
            break

        # Construct a one-shot inbox that receives the generated image (handled by `receive_generated_image`)
        image_inbox = nc.new_inbox()
        await nc.subscribe(image_inbox, cb = receive_generated_image, max_msgs=1)

        # Construct a one-shot inbox that displays a notification when the server assigns a worker
        worker_assigned = f"{image_inbox}.worker-assigned"
        await nc.subscribe(worker_assigned, cb = notify_assigned_worker, max_msgs=1)

        # Subscribe to when a worker posts progress on image generation
        worker_progress = f"{image_inbox}.worker-progress"
        await nc.subscribe(worker_progress, cb = notify_worker_progress, max_msgs=4)

        # Ask the user some questions and then construct the img-gen request
        height = typed_input("Enter height (blank for default of 128): ", AtLeast32PxImageDimension, 128)
        width  = typed_input("Enter width (blank for default of 128): ", AtLeast32PxImageDimension, 128)
        image_gen_opts = dict(prompt = prompt, numSteps = 4, height = height, width = width)
        payload_string = json.dumps(image_gen_opts)
        payload_bytes = payload_string.encode()
        headers = dict(imageInbox = image_inbox)

        # Send it off and do not proceed until the future completes (indicating we got a response back)
        try:
            await nc.publish('img-gen', payload_bytes, reply = requester_id, headers = headers)
            await asyncio.wait_for(img_gen_future, timeout=None)
        except Exception as e:
            print(str(e))
        
    # Wind down
    await nc.drain()

def typed_input(user_prompt, klass, default):
    while True:
        val = input(user_prompt).strip()
        if val == '':
            return default
        try:
            return klass(val)
        except:
            print(f"Invalid input. Must be {klass.__name__}. Try again.")
    
def AtLeast32PxImageDimension(x : str):
    parsed = int(x)
    if parsed < 32:
        raise Exception()
    return parsed
    

if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--nats_server_address", type = str, default = "nats://localhost:4223")
    cli_args = parser.parse_args()
    asyncio.run(main(cli_args))