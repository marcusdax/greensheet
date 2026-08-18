# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS dev
ENV NODE_ENV=development
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY . .
COPY --from=localization . /localization/02-locale-files/
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
