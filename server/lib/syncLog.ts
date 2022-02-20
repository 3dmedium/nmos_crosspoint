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
