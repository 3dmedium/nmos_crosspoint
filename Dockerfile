FROM node:20 AS base

COPY ./ui /nmos-crosspoint/ui
COPY ./server /nmos-crosspoint/server
ENV PATH /nmos-crosspoint/server/node_modules/.bin:$PATH
ENV PATH /nmos-crosspoint/ui/node_modules/.bin:$PATH



WORKDIR /nmos-crosspoint/ui
RUN npm install
RUN npm run build

WORKDIR /nmos-crosspoint/server
RUN npm install -g typescript@latest
RUN npm install
RUN npm run build

CMD cd /nmos-crosspoint/server && node ./dist/server.js
