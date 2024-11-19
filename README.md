## Introduction

This repository implements 

## Overview

There are three components to this project:
1. **server** - a docker-compose stack which has a NATs server, a bun process, and a postgres DB.
2. **worker** - a copy of `mflux` wrapped with a NATs client. Multiple instances can be spun up to simulate a pool of workers.
3. **requester** - a simple python script which asks for image prompts from the user (you)

Based on our conversation, you are probably going to be most interested in:
`server/imgGenRequestHandler.ts`

## Design

<include design pic here>

## Some Thoughts (What I Would Do Differently The 2nd Time)
1. If I really wanted this thing to scale, I should have included a write-behind cache (like Redis) between the bun process and postgres
2. I should have spent some more time looking into JetStream - might have simplified the implementation a bit

## Starting The Server

As a prerequisite, you'll need to have Docker installed and the Docker daemon running.
To build and start the server:
* Open a new terminal
* Be in the root directory of the repo
* Run `docker compose up`

##  Requester/Worker Setup

Using Python 3.11+ (may work in earlier versions, haven't tested them):
1. In the root directory of the repo, create a virtual environment: `python -m venv .venv`
2. Activate the virtual environment: `source .venv/bin/activate`
3. Install the project requirements: `pip install .`
4. Download the HuggingFace models for mflux: `python worker/download_hf_model.py`

## Starting Workers and Requester
1. In all terminal windows, always have the virtual environment activated: `source .venv/bin/activate`
2. Start a requester: `python requester/requester.py`
3. Start one or more workers in separate terminal windows: `python worker/worker.py`
Create multiple workers to create a pool of workers that get randomly assigned work from the server.



