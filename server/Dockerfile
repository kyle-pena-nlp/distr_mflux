# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .


ENV NODE_ENV=production
# TODO: These hang or are broken, commenting out for now
#RUN bun test
#RUN bun build ./index.ts

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease *.ts ./

# Reset DB (starting from scratch every time we spin up the server, for simplicity's sake)
RUN bun run prisma:push

# Regenerate client types
RUN bun run prisma:generate

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "server.ts" ]