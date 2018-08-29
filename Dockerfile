FROM node:8.11.4

# RUN apk update && apk upgrade && \
#     apk add --no-cache bash git openssh python make gcc

WORKDIR /app
ADD package.json npm-shrinkwrap.json ./
RUN npm install --production

ADD . .
ADD conf-docker.json conf.json

VOLUME /root/.eth-indexer/

EXPOSE 9898

ENTRYPOINT []

CMD ["npm", "start"]
