FROM node:alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

ARG ENV_FILE

COPY $ENV_FILE .env

RUN npm run build

FROM nginx:stable-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
