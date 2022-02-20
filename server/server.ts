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

import * as fs from "fs";
import { NmosRegistryConnector } from "./lib/nmosConnector";
import { SyncLog } from "./lib/syncLog";
import { SyncState } from "./lib/syncState";
import { WebsocketClient } from "./lib/websocketClient";

import { WebsocketSyncServer } from "./lib/websocketSyncServer";

WebsocketSyncServer.init(80);
let server = WebsocketSyncServer.getInstance();

const connector = new NmosRegistryConnector();
const log = new SyncLog();
const state = new SyncState();

server.addSyncObject(log);

server.addSyncObject(connector.syncNmos);
server.addSyncObject(connector.syncConnectionState);

server.addSyncObject(state.aliases);
server.addSyncObject(state.hidden);

server.addRoute("POST", "makeconnection", (client: WebsocketClient, postData: any) => {
    return new Promise((resolve, reject) => {
        connector
            .makeConnection(postData.receiverId, postData.senderId)
            .then((m) => resolve(m))
            .catch((m) => reject(m));
    });
});

server.addRoute("POST", "stateAddAlias", (client: WebsocketClient, postData: any) => {
    return new Promise((resolve, reject) => {
        state
            .addAlias(postData.id, postData.type, postData.alias)
            .then((m) => resolve(m))
            .catch((m) => reject(m));
    });
});

server.addRoute("POST", "stateToggleHidden", (client: WebsocketClient, postData: any) => {
    return new Promise((resolve, reject) => {
        state
            .toggleHidden(postData.id, postData.type)
            .then((m) => resolve(m))
            .catch((m) => reject(m));
    });
});
