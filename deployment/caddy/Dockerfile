#
# Custom Caddy built with:
# - Rate limit plugin
#

FROM caddy:2-builder AS builder
RUN xcaddy build \
      --with github.com/mholt/caddy-ratelimit

FROM caddy:2

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile