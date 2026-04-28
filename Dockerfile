# DMS Template Server — extends the upstream dms-server runtime with this
# repo's app-owned datatype plugins (data-types/) loaded via DMS_EXTRA_DATATYPES.
#
# Build:  docker build -t dms-template-server .
# Run:    docker run -d --env-file .env -p 5555:5555 \
#           -v dms-template-data:/app/src/dms/packages/dms-server/var \
#           --name dms-template-server dms-template-server
#
# Required: the dms submodule must be checked out at src/dms/ before building.
#   git submodule update --init --recursive
#
# Environment variables (see src/dms/packages/dms-server/Dockerfile for the full list):
#   PORT                  Server port (default: 5555)
#   DMS_DB_ENV            DMS database config name
#   DMS_AUTH_DB_ENV       Auth database config name
#   DMS_STORAGE_TYPE      'local' (default) or 's3'
#   DMS_EXTRA_DATATYPES   Set by this image to /app/server/register-datatypes.js

FROM node:22-bookworm-slim

WORKDIR /app

# Native deps: gdal for GIS, build tools for native addons (sharp, better-sqlite3, gdal-async).
RUN apt-get update && apt-get install -y \
      gdal-bin \
      libgdal-dev \
      build-essential \
      python3 \
      zip \
      --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 1) Stage the dms-server submodule package so the file: link below has a target.
COPY src/dms/packages/dms-server ./src/dms/packages/dms-server

# 2) Minimal /app/package.json that depends ONLY on dms-server (via file: link).
#    Avoids pulling the frontend devDeps and lets npm do a single hoist-aware
#    install: @availabs/dms-server is symlinked into /app/node_modules, and
#    its runtime deps (lodash, express, sharp, gdal-async, better-sqlite3, …)
#    are installed and hoisted to /app/node_modules. That hoist is what makes
#    `require('lodash')` and `require('@availabs/dms-server/src/...')` from
#    /app/data-types/* resolve via Node's upward node_modules walk.
RUN printf '%s\n' \
      '{' \
      '  "name": "dms-template-server",' \
      '  "version": "0.0.0",' \
      '  "private": true,' \
      '  "dependencies": {' \
      '    "@availabs/dms-server": "file:./src/dms/packages/dms-server"' \
      '  }' \
      '}' > package.json

RUN npm install --omit=dev

# 3) Template-owned plugin code. data-types/ MUST be a sibling of server/ so
#    register-datatypes.js's `require('../data-types/...')` resolves.
COPY data-types ./data-types
COPY server ./server

# Persistent storage: host ID, upload temp files, local file storage.
VOLUME /app/src/dms/packages/dms-server/var

ENV NODE_ENV=production \
    PORT=5555 \
    DMS_EXTRA_DATATYPES=/app/server/register-datatypes.js

EXPOSE 5555

# WORKDIR matches the upstream image so:
#   - `--env-file-if-exists=../../../../.env` resolves to /app/.env
#   - `--env-file-if-exists=.env` resolves to the dms-server dir
#   - var/ paths and db config relative paths behave identically.
WORKDIR /app/src/dms/packages/dms-server

# Liveness probe: only verifies the HTTP listener is up. The upstream image's
# healthcheck pings dms.data._ping+_ping.length, which can return 500 on
# production databases (e.g. when a per-app split mode tries to create a
# schema for the magic `_ping` app and lacks CREATE privileges, or when
# legacy/per-app divergence makes ensureForRead throw). For deploy gating we
# only need "is the server accepting HTTP" — a route returning 4xx/5xx still
# means the process booted, bound the port, and is responding.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5555) + '/graph', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(()=>process.exit(0)).catch(()=>process.exit(1))"

CMD ["node", "--max-http-header-size=1048576", "src/index.js"]
