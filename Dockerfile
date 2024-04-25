FROM node:20.12.2

RUN set -eux ; \
  apt-get update ; apt-get upgrade -y

WORKDIR /app

COPY app/package*.json .
RUN npm install

COPY app .

RUN chmod a+x /app/entrypoint.sh

EXPOSE 8080
ENTRYPOINT [ "/app/entrypoint.sh", "start" ]
