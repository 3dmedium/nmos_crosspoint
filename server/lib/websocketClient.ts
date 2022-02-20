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

import * as WebSocket from "ws";

import { WebsocketSyncServer } from "./websocketSyncServer";

export class WebsocketClient {
    private ws: WebSocket;

    private env = {};
    public getEnv() {
        return this.env;
    }

    private subscriptionList = [];

    constructor(s: WebSocket, e: any) {
        this.ws = s;
        this.env = e;

        this.ws.on("message", (text: string) => {
            if (text == "ping" && this.ws.OPEN) {
                this.ws.send("pong");
            } else {
                try {
                    const m = JSON.parse(text);
                    this.processMessage(m);
                } catch (e) {}
            }
        });
        this.ws.on("close", () => {
            WebsocketSyncServer.getInstance().disconnectClient(this);
        });
    }

    destructor() {}
    isConnected() {
        return !this.ws.CLOSED;
    }

    private send(obj) {
        if (this.ws.OPEN) {
            this.ws.send(JSON.stringify(obj));
        }
    }

    sendObjectSyncData(channelName: string, action: string, objectId: any, state: any) {
        this.send({
            type: "sync",
            channel: channelName,
            objectId: objectId,
            action: action,
            data: state,
        });
    }

    private processMessage(message) {
        switch (message.type) {
            case "request":
                this.processRequest(message);
                break;
            case "sync":
            case "unsync":
                this.processSync(message);
                break;
        }
    }

    processRequest(message) {
        WebsocketSyncServer.getInstance()
            .request(message, this)
            .then((data) => {
                this.send(data);
            })
            .catch((e) => {
                this.send(e);
            });
    }

    processSync(message) {
        if (message.type === "sync") {
            if (typeof message.channel === "string") {
                let objectId = 0;
                if (typeof message.objectId === "string" || typeof message.objectId === "number") {
                    objectId = message.objectId;
                }
                WebsocketSyncServer.getInstance().subscribeSyncObject(message.channel, this, objectId);
            }
        } else if (message.type === "unsync") {
            if (typeof message.channel === "string") {
                let objectId = 0;
                if (typeof message.objectId === "string" || typeof message.objectId === "number") {
                    objectId = message.objectId;
                }
                WebsocketSyncServer.getInstance().unsubscribeSyncObject(message.channel, this, objectId);
            }
        }
    }
}
