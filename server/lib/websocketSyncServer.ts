/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb (info@3dmedium.de)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License Version 3
    as published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. 
*/

import * as cluster from "cluster";
import * as WebSocket from "ws";

var path = require("path");

const express = require("express");

import { WebsocketClient } from "./websocketClient";
import { SyncObject } from "./syncObject";

interface SyncObjectList {
    [key: string]: SyncObject;
}

export class WebsocketSyncServer {
    public static init(port) {
        WebsocketSyncServer.instance = new WebsocketSyncServer(port);
    }

    private static instance: WebsocketSyncServer;

    private server: any;

    public static getInstance(): WebsocketSyncServer {
        if (!WebsocketSyncServer.instance) {
            return null;
        }
        return WebsocketSyncServer.instance;
    }
    private wss: WebSocket.Server = null;

    // TODO client List Cleanup on closed
    private clientList: WebsocketClient[] = [];

    private routeList = {};
    private syncObjectList: SyncObjectList = {};

    public addRoute(method, route, func) {
        this.routeList[method + "_" + route] = func;
    }
    public request(message, client: WebsocketClient) {
        return new Promise((resolve, reject) => {
            if (this.routeList.hasOwnProperty(message.method + "_" + message.route)) {
                this.routeList[message.method + "_" + message.route](client, message.data)
                    .then((data) => {
                        resolve({
                            type: "response",
                            method: message.method,
                            id: message.id,
                            status: data["status"] ? data["status"] : 200,
                            message: data.message,
                            data: data.data,
                        });
                    })
                    .catch((error) => {
                        reject({
                            type: "response",
                            method: message.method,
                            id: message.id,
                            status: error["status"] ? error["status"] : 404,
                            message: error["message"] ? error["message"] : "not found",
                            error: error["error"] ? error["error"] : {},
                        });
                    });
            } else {
                // TODO Logging
                reject({
                    type: "response",
                    method: message.method,
                    id: message.id,
                    status: 404,
                    message: "not found",
                    error: {},
                });
            }
        });
    }

    public addSyncObject(syncObject: SyncObject) {
        this.syncObjectList[syncObject.getName()] = syncObject;
    }
    public updateSyncObject(name: string, action: string, data: any, objectId: string | number = 0) {
        if (this.syncObjectList.hasOwnProperty(name)) {
            switch (action) {
                case "reset":
                    this.syncObjectList[name].setState(data, objectId);
                    break;
                case "patch":
                    this.syncObjectList[name].patchState(data, objectId);
                    break;
            }
        } else {
            //TODO logging and response for not subscribed
        }
    }

    public subscribeSyncObject(name: string, client: WebsocketClient, objectId: string | number = 0) {
        if (this.syncObjectList.hasOwnProperty(name)) {
            this.syncObjectList[name].subscribe(client, objectId);
        } else {
            //TODO logging and response for not ???
        }
    }

    public unsubscribeSyncObject(name: string, client: WebsocketClient, objectId: string | number = 0) {
        if (this.syncObjectList.hasOwnProperty(name)) {
            this.syncObjectList[name].unsubscribe(client, objectId);
        } else {
            //TODO logging and response for not subscribed
        }
    }

    disconnectClient(client: WebsocketClient) {
        const index = this.clientList.indexOf(client);
        if (index > -1) {
            this.clientList.splice(index, 1);
        }
    }

    private constructor(port) {
        this.wss = new WebSocket.Server({ noServer: true });
        this.wss.on("connection", (ws) => {
            console.log("new connection");
            const client = new WebsocketClient(ws, {});
            this.clientList.push(client);
        });

        this.server = express();
        this.server.use(express.static("./public"));
        this.server.all("/*", function (req, res, next) {
            res.sendFile(path.resolve("./") + "/public/index.html");
        });

        const ls = this.server.listen(port, () => {
            console.log("Server ist listening on port: " + port);
        });

        ls.on("upgrade", (request, socket, head) => {
            this.wss.handleUpgrade(request, socket, head, (socket) => {
                this.wss.emit("connection", socket, request);
            });
        });
    }
}
