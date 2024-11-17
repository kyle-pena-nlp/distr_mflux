## Introduction

This repository implements 

## Setup

Prereq: Docker

1. Start server and associated infrastructure (NATs, Bun): `docker compose up`

2. Start a consumer: `bun consumer/consumer.ts`. Repeat in new terminals as many times as you like.

3. Start a worker: `bun worker/worker.ts`.  Repeat in new terminals as many times as you like. 

Open multiple terminals to get multiple consumers and/or producers.




