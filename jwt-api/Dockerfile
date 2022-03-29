FROM node:16-alpine
RUN mkdir /app
COPY package.json yarn.lock /app/
WORKDIR /app
RUN yarn install
COPY prisma/schema.prisma prisma/
ARG DATABASE_URL
RUN yarn prisma generate
COPY . .
CMD ["yarn", "dev"]
