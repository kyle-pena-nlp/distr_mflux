# use the official Bun image
FROM oven/bun:1-debian AS base

WORKDIR /src


# Copy resources and install
COPY . .
RUN bun install --frozen-lockfile --production

# Regenerate PrismaClient types (and emitting environment variables into .env file)
RUN bun run prisma generate

# Reset DB (starting from scratch every time we spin up the server, for simplicity's sake)
# This command won't work if you are building the Dockerfile as a stand-alone
# (DATABASE_URL needs to be defined)
#RUN bun run prisma db push --force-reset



# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "server.ts" ]