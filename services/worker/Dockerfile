FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
COPY services ./services
COPY packages ./packages
COPY database ./database
RUN test -s database/prisma/schema.prisma && test -n "$(find database/prisma/migrations -type f -name migration.sql -print -quit)"
RUN npm ci
RUN npm run db:generate
CMD ["npm", "--workspace", "services/worker", "run", "dev"]
