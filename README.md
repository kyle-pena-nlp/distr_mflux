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
2. In the root directory of the repo, create a virtual environment: `python -m venv .venv`
3. Activate the virtual environment: `source .venv/bin/activate`
4. Install the project requirements: `pip install .`
5. Download the HuggingFace models for mflux: `python worker/download_hf_model.py`
It takes about ~30 mins to download the model and takes about 50GB of disk space.

## Starting The Server

As a prerequisite, you'll need to have Docker installed and the Docker daemon running.
To build and start the server:
* Open a new terminal
* Be in the root directory of the repo
* Run `docker compose up`



## Starting Workers and Requester
1. In all terminal windows, always have the virtual environment activated: `source .venv/bin/activate`
2. Start a requester: `python requester/requester.py`
3. In a new terminal window, start a worker: `python worker/worker.py`
4. Repeat (3)
Create multiple workers to create a pool of workers that get randomly assigned work from the server.



