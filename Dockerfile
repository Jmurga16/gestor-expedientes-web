FROM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
ARG SITE_URL=https://traza.devkora.com
RUN sed -i "s#https://gestor-expedientesv1.azurewebsites.net#${SITE_URL}#g" src/index.html \
    && npx ng build --configuration production,vps \
    && grep -q "${SITE_URL}/og-image.jpg" dist/expedientes-front/browser/index.html

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist/expedientes-front/browser /srv
RUN rm -f /srv/web.config
