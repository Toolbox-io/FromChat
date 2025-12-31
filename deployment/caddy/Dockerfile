#
# Custom Caddy built with:
# - Rate limit plugin
#

FROM caddy:2-builder AS builder
RUN xcaddy build \
      --with github.com/mholt/caddy-ratelimit
RUN curl -o /etc/ssl/cloudflare-origin.crt https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem

FROM caddy:2

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile