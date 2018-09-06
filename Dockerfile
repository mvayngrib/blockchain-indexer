#FROM node:8.11.4

FROM keymetrics/pm2:8-jessie

# RUN apk update && apk upgrade && \
#     apk add --no-cache bash git openssh python make gcc

WORKDIR /app
ADD package.json npm-shrinkwrap.json ./
RUN npm install --production

ADD . .
ADD conf-docker.json conf.json
ADD pm2.json .
RUN ls -al -R

VOLUME /root/.eth-indexer/

EXPOSE 3000

ENTRYPOINT []

CMD [ "pm2-runtime", "start", "pm2.json" ]
