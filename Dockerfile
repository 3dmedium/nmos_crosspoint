FROM node:16 AS base

COPY ./app /nmos-crosspoint/app
COPY ./server /nmos-crosspoint/server
ENV PATH /nmos-crosspoint/server/node_modules/.bin:$PATH



WORKDIR /nmos-crosspoint/app
RUN npm install --force
RUN npm run build

WORKDIR /nmos-crosspoint/server

RUN npm install -g typescript@latest
RUN npm install -g tsc-watch@latest
RUN npm install
RUN npm run build

CMD cd /nmos-crosspoint/server && node ./dist/server.js
