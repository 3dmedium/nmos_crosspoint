/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
*/

import * as WebSocket from "ws";
import axios from "axios";
import { SyncObject } from "./syncObject";
import { Subject } from "rxjs";
import { WebsocketClient } from "./websocketClient";

const fs = require("fs");

export class SyncState {
    public aliases: SyncObject;
    public hidden: SyncObject;

    constructor() {
        let nameMapping: any = { device: {}, sender: {}, receiver: {} };
        try {
            let rawFile = fs.readFileSync("./config/aliases.json");
            nameMapping = JSON.parse(rawFile);
        } catch (e) {}

        let hiddenObjects: any = { sender_device: {}, receiver_device: {}, sender: {}, receiver: {} };
        try {
            let rawFile = fs.readFileSync("./config/hidden.json");
            hiddenObjects = JSON.parse(rawFile);
        } catch (e) {}

        this.aliases = new SyncObject("aliases");
        this.hidden = new SyncObject("hidden");

        this.aliases.setState(nameMapping);
        this.hidden.setState(hiddenObjects);
    }

    saveAliasFile() {
        let s = this.aliases.getStateCopy();
        fs.writeFile("./config/aliases.json", JSON.stringify(s), (response) => {});
    }
    saveHiddenFile() {
        let s = this.hidden.getStateCopy();
        fs.writeFile("./config/hidden.json", JSON.stringify(s), (response) => {});
    }

    addAlias(id: string, type: string, alias: string) {
        return new Promise((resolve, reject) => {
            if (["device", "sender", "receiver"].includes(type)) {
                if (alias == "") {
                    try {
                        let s = this.aliases.getStateCopy();
                        delete s[type][id];
                        this.aliases.setState(s);

                        this.saveAliasFile();
                    } catch (e) {
                        reject(e);
                        return;
                    }
                    resolve({
                        message: "Alias was removed",
                    });
                } else if (typeof alias == "string" && alias.length < 100) {
                    try {
                        let s = this.aliases.getStateCopy();
                        s[type][id] = alias;
                        this.aliases.setState(s);

                        this.saveAliasFile();
                    } catch (e) {
                        reject(e);
                        return;
                    }
                    resolve({
                        message: "Alias was updated",
                    });
                } else {
                    reject({
                        message: "Alias should be strinmg with less than 100 Chars.",
                    });
                }
            } else {
                reject({
                    message: "Type unknown",
                });
            }
        });
    }

    toggleHidden(id: string, type: string) {
        return new Promise((resolve, reject) => {
            if (["sender_device", "receiver_device", "sender", "receiver"].includes(type)) {
                try {
                    let s = this.hidden.getStateCopy();
                    if (s[type][id] == true) {
                        delete s[type][id];
                    } else {
                        s[type][id] = true;
                    }

                    this.hidden.setState(s);

                    this.saveHiddenFile();
                } catch (e) {
                    reject(e);
                    return;
                }
                resolve({
                    message: "Hidden object was toggled.",
                });
            } else {
                reject({
                    message: "Type unknown",
                });
            }
        });
    }
}
