# use the official Bun image
FROM oven/bun:1-debian AS base

WORKDIR /src



# Copy resources and install
COPY . .
RUN bun install --frozen-lockfile --production

# Regenerate PrismaClient types and client
RUN bun run prisma generate

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "server.ts" ]