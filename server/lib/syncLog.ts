/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
*/

import * as WebSocket from "ws";
import axios from "axios";
import { SyncObject } from "./syncObject";
import { Subject } from "rxjs";
import { WebsocketClient } from "./websocketClient";

export class SyncLog extends SyncObject {
    static instance: SyncLog;
    static log(severity: string, text: string, type: string, raw: any) {
        if (SyncLog.instance) {
            return SyncLog.instance.pushMessage(severity, text, type, raw);
        } else {
            return new Promise((resolve, reject) => {
                resolve(false);
            });
        }
    }

    limitHistory = 10;
    constructor() {
        super("log");
        SyncLog.instance = this;
    }

    readState(objectId) {
        objectId = "" + objectId;
        if (!this.startReadState(objectId)) {
            return;
        }
        this.endReadState(objectId, { logList: [] });
    }
    pushMessage(severity: string, text: string, type: string, raw: any) {
        return new Promise((resolve, reject) => {
            let message = {
                time: new Date().getTime(),
                severity,
                text,
                type,
                raw,
            };

            let state = this.getStateCopy();

            state.logList.push(message);
            if (state.logList.length > this.limitHistory) {
                state.logList.shift();
            }

            this.setState(state);
            resolve(true);
        });
    }
}
