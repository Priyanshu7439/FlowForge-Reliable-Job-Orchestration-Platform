FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
COPY services ./services
COPY packages ./packages
COPY database ./database
RUN npm ci
CMD ["npm", "--workspace", "apps/web", "run", "dev"]
