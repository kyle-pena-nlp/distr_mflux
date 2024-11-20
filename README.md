## Introduction

This repository is a prototype of a distributed platform for image generation using the NATs message protocol.

It uses a Bun service to orchestrate the selection of a worker from a pool of workers, and relies entirely on NATs (no HTTP requests involved).

## Overview

There are three components to this project:
1. **server** - a docker-compose stack which has a NATs server, a bun process, and a postgres DB.
2. **mflux worker** - a copy of `mflux` wrapped with a NATs client. Multiple instances can be spun up to simulate a pool of workers.
3. **requester** - a simple python script which asks for image prompts from the user (you)

Based on our conversation, you are probably going to be most interested in:
`server/imgGenRequestHandler.ts`

##  Python Setup

You'll want to do these Python setup steps **first**.

Use Python 3.12 (it may work in other Python versions, but no guarantees).
1. `cd` to the root of the repo (which contains `client`, `db` as subfolders)
2. In the root directory of the repo, create a virtual environment: 
   
   `python3 -m venv .venv`
3. Activate the virtual environment: 
   
   `source .venv/bin/activate`
4. Install the project requirements: 
   
   `pip3 install .`
5. Download the HuggingFace models for mflux: 
   
   `python3 worker/download_hf_model.py` 
   
   (HF's included downloader is a little flaky so it may require a restart or two)

    It takes about ~30 mins to download the model and takes about 50GB of disk space.

## Starting The Server

As a prerequisite, you'll need to have Docker installed and the Docker daemon running.
To build and start the server stack:
* Open a new terminal
* Be in the root directory of the repo
* Run `docker compose up`



## Starting Workers and Requester
1. In a new terminal window, activate the virtual environment, and then start a worker: 
   
   `python3 worker/worker.py`
2. In a new terminal window, activate the virtual environment, and then start a requester: 
   
   `python3 requester/requester.py`
3. Repeat (1) a few times to create a pool of workers

You can give a worker a specific ID by using the CLI argument `--worker_id`.  For example:

`python3 worker/worker.py --worker_id blacklisted-worker`

As an FYI, I init'd the Postgres DB to contain a single blacklisted worker named `blacklisted-worker`, so the Bun service will refuse to schedule work for a worker created with that `--worker_id`.

## How It Works

When the user enters a prompt, height, and width, the requester serializes these parameters into bytes and pubs it to `img-gen`.  The requester also generates a 1-shot inbox (`imageInbox`) that will eventually receive the generated image from the mflux worker.  The `imageInbox` is included in the header of the `img-gen` pub.

The Bun service is subscribed to `img-gen` and fires off an asynchronous handler in response.

![alt text](doc/image-1.png)

The Bun Server `img-gen` handler requests an available worker from the workers pool by pub'ing to `request-worker`.  Because each worker in the worker pool is sub'd to `request-worker` as a part of a [queue group](https://docs.nats.io/nats-concepts/core-nats/queue), just one worker gets randomly selected from the pool.

![alt text](doc/image-2.png)

The randomly selected mflux worker responds by identifying itself in the header, and indicating whether it is willing to receive the image generation request.

![alt text](doc/image-3.png)

The Bun Server takes the identity of the selected worker and cross-checks it against a list of blacklisted workerIds.  If the worker is blacklisted or the worker is not willing to accept work, the Bun server requests another worker from the queue group until this process is successful.

![alt text](doc/image-4.png)

Finally, the image generation request is sent to the selected mflux worker, with the `reply` field sent to the `imageInbox`, which the requester is sub'd to.

![alt text](doc/image-5.png)

When the mflux worker finishes generating the image, it sends the bytes of the generated image directly to the requester, which is deserialized and saved to disk.

![alt text](doc/image-6.png)

I'm glossing over a lot of details.  Here are a few:
1. The Bun Server is *also* pub'd to several of these events, and updates the Postgres database when it receives messages.
2. The requester is pub'd to percent completion events from the worker.

## TODO

1. Implement an image verification scheme and integrate it with the blacklisted workers list
2. Build a JSX-based dashboard for realtime monitoring of the Bun service

## Final Thoughts

If I were building this system less as a weekend project and more for real, I would make different choices:
1. I would make actual UIs for the requester and worker, not just Python scripts.
2. I would *not* use mflux because it only executes on MacOS.  I would find some way to port *flux* itself into a background execution process.
3. I would probably put some kind of write-behind cache between the Bun service and the DB if perf monitoring indicated that the (chatty) DB writes were a bottleneck - I think they might be.
4. I would use NAT's JetStream features because of the delivery guarantees it has.
5. WorkerID would be based off of a device identifier.