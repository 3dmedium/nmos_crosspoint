/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
*/

import { WebsocketClient } from "./websocketClient";
import { applyPatch, createPatch } from "rfc6902";
import * as jsonpatch from 'fast-json-patch';

interface ClientListEntry {
    client: WebsocketClient;
    objectId: string | number;
}

export class SyncObject {
    public requiredPermission = "global";
    public name: string = "";
    protected reading = {};
    protected readWaiting = {};
    public getName() {
        return this.name;
    }

    constructor(name: string, state:any = null) {
        if(state){
            this.setState(state)
        }
        this.name = name;
    }

    protected state = {};

    private clientList: ClientListEntry[] = [];
    subscribe(client: WebsocketClient, objectId: string | number = 0) {
        objectId = "" + objectId;
        if (
            this.clientList.find((entry) => {
                return entry.client === client && entry.objectId == objectId;
            })
        ) {
            // no double subscriptions !
        } else {
            this.clientList.push({ client: client, objectId: objectId });
            if (!this.state.hasOwnProperty(objectId)) {
                this.readState(objectId);
            } else {
                client.sendObjectSyncData(this.name, "init", objectId, this.state[objectId]);
            }
        }
    }
    unsubscribe(client: WebsocketClient, objectId: string | number = 0) {
        objectId = "" + objectId;
        this.clientList = this.clientList.filter((c) => {
            return !(c.client == client && c.objectId == objectId);
        });
    }

    private send(action: string, data, objectId: string | number = 0) {
        objectId = "" + objectId;
        this.clientList.forEach((c) => {
            if (c.objectId == objectId) {
                c.client.sendObjectSyncData(this.name, action, objectId, data);
            }
        });
    }

    getState(objectId: string | number = 0) {
        objectId = "" + objectId;
        if (!this.state.hasOwnProperty(objectId)) {
            this.readState(objectId);
        }
        // TODO
        return this.state[objectId];
    }
    getStateCopy(objectId: string | number = 0) {
        objectId = "" + objectId;
        if (!this.state.hasOwnProperty(objectId)) {
            this.readState(objectId);
        }
        return jsonpatch.deepClone(this.state[objectId]);
        //return JSON.parse(JSON.stringify(this.state[objectId]));
    }

    private copyObject(obj) {
        return jsonpatch.deepClone(obj)
        //return JSON.parse(JSON.stringify(obj));
    }

    setState(data, objectId: string | number = 0, clientReset = false) {
        objectId = "" + objectId;
        
        if(!this.state[objectId]){
            this.state[objectId] = {};
        }
        //let patch = createPatch(this.state[objectId], data);
        var patch = jsonpatch.compare(this.state[objectId], data);

        this.state[objectId] = this.copyObject(data);
        if (clientReset) {
            this.send("init", this.state[objectId], objectId);
        } else {
            if(Array.isArray(patch) && patch.length == 0){
            }else{
                this.send("patch", patch, objectId);
            }
        }
    }

    patchState(patch, objectId: string | number = 0) {
        objectId = "" + objectId;
        jsonpatch.applyPatch(this.state[objectId], patch);
        if(Array.isArray(patch) && patch.length == 0){
        }else{
            this.send("patch", patch, objectId);
        }
    }

    readState(objectId: string | number = 0) {
        objectId = "" + objectId;
        if (this.reading[objectId]) {
            return;
        }
        this.reading[objectId] = true;
        setImmediate(() => {
            this.reading[objectId] = false;
            this.setState({}, objectId, true);
        });
    }

    startReadState(objectId) {
        if (this.reading[objectId]) {
            this.readWaiting[objectId] = true;
            return false;
        }
        this.reading[objectId] = true;
        return true;
    }
    endReadState(objectId, state = null, forceReset = false) {
        if (state != null) {
            if (this.state.hasOwnProperty(objectId) && !forceReset) {
                this.setState(state, objectId, false);
            } else {
                this.state[objectId] = {};
                this.setState(state, objectId, true);
            }
        }
        this.reading[objectId] = false;
        if (this.readWaiting[objectId]) {
            this.readState(objectId);
            this.readWaiting[objectId] = false;
        }
    }
}
