## Introduction

This repository is a prototype of a distributed platform for image generation using the NATs message protocol. 

## Overview

There are three components to this project:
1. **server** - a docker-compose stack which has a NATs server, a bun process, and a postgres DB.
2. **worker** - a copy of `mflux` wrapped with a NATs client. Multiple instances can be spun up to simulate a pool of workers.
3. **requester** - a simple python script which asks for image prompts from the user (you)

Based on our conversation, you are probably going to be most interested in:
`server/imgGenRequestHandler.ts`

##  Python Setup

The requester and worker are python scripts (the server is a bun process).
You'll want to do these setup steps **first**.

Use Python 3.12 (it may work in other Python versions, but no guarantees).
1. `cd` to the root of the repo (which contains `client`, `db` as subfolders)
2. In the root directory of the repo, create a virtual environment: `python3 -m venv .venv`
3. Activate the virtual environment: `source .venv/bin/activate`
4. Install the project requirements: `pip3 install .`
5. Download the HuggingFace models for mflux: `python3 worker/download_hf_model.py` (this may require a restart or two if the network is flaky- but it seems to pick up where it left off)
It takes about ~30 mins to download the model and takes about 50GB of disk space.

## Starting The Server

As a prerequisite, you'll need to have Docker installed and the Docker daemon running.
To build and start the server:
* Open a new terminal
* Be in the root directory of the repo
* Run `docker compose up`



## Starting Workers and Requester
1. In all terminal windows, always have the virtual environment activated: `source .venv/bin/activate`
2. In a new terminal window, activate the virtual environment activated, start a worker: `python3 worker/worker.py`
3. In a new terminal window, activate the virtual environment activated, start a requester: `python3 requester/requester.py`
4. Repeat (3) to create a pool of workers



