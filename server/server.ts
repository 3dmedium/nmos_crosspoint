/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
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
