## Introduction

This repository implements 

## Overview

There are three components to this project:
1. **server** - a docker-compose which hosts a NATs server, a bun process, and a postgres DB.
2. **worker** - a copy of `mflux` wrapped with a NATs client. Multiple instances can be spun up to simulate a pool of workers.
3. **consumer** - a simple python script which asks for prompts and receives the generated image as a bytes payload from the worker.

## Server Setup

As a prerequisite, you'll need to have Docker installed and the Docker daemon running.
The server and its dependent services are orchestrated with docker compose.
To start the server:
* Open a new terminal
* Be in the root directory of the repo
* Run `docker compose up`

## Consumer Setup
* Open a new terminal
* Be in the root directory of the repo. 
* The server must be running or the consumer can't connect to NATs
* Have Python 3.11+ installed. 

Using Python 3.11+:
1. In the root directory of the repo, create a virtual environment: `python -m venv .venv`
2. Activate the virtual environment: `source .venv/bin/activate`
3. Install the project requirements: `pip install .`
To start the consumer, run: `python consumer/consumer.py`

## Worker Setup
* Open a new terminal
* Be in the root directory of the repo. 
* The server must be running or the worker can't connect to NATs
* Have Python 3.11+ installed.  

Using Python 3.11+:
1. In the root directory of the repo, create a virtual environment: `python -m venv .venv`
2. Activate the virtual environment: `source .venv/bin/activate`
3. Install the project requirements: `pip install .`
To start the consumer, run: `python worker/worker.py`
Rinse and repeat in new terminal windows to simulate a pool of workers.

## Summary

So, in summary:
1. Start the server in a terminal
2. Start one or more workers in more terminals
3. Start a consumer in a final terminal





