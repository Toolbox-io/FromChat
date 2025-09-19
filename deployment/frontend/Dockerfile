# 1. Build the frontend
FROM node:24 AS frontend

# 1.1. Install npm dependencies
WORKDIR /app
COPY package.json .
RUN --mount=type=cache,target=/root/.npm \
    npm install --ignore-scripts

# 1.2. Build
COPY frontend frontend
RUN npm run frontend:build

# 2. Build the static file server
FROM node:24 AS server

# 2.1. Install npm dependencies
WORKDIR /server
COPY deployment/frontend/package.json .
RUN --mount=type=cache,target=/root/.npm \
    npm install

# 2.2. Copy the code
COPY deployment/frontend/ .

# 3. Put it all together
FROM node:24-slim

# 3.1. Non-root user
RUN useradd -u 1001 app && \
    mkdir -p /app && \
    chown -R app /app && \
    mkdir /server && \
    chown -R app /server
USER app

# 3.1. Frontend static files
WORKDIR /app
COPY --from=frontend --chown=app /app/frontend/build/normal/dist .

# 3.2. Static file server
WORKDIR /server
COPY --from=server --chown=app /server .

# 4. Final command
ENV STATIC_FILE_PATH=/app
ENTRYPOINT ["npm", "run", "start"]