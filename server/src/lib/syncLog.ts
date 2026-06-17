/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
*/

import * as WebSocket from "ws";
import axios from "axios";
import { SyncObject } from "./SyncServer/syncObject";
import { Subject } from "rxjs";
import { WebsocketClient } from "./SyncServer/websocketClient";

export class SyncLog extends SyncObject {
    static instance: SyncLog;


    static critical(topic: string,text: string, raw: any= null) {
        return SyncLog.log("critical",  topic,text, raw);
    }

    static error(topic: string,text: string, raw: any= null) {
        return SyncLog.log("error",  topic,text, raw);
    }
    static warning(topic: string,text: string, raw: any= null) {
        return SyncLog.log("warning",  topic,text, raw);
    }
    static info(topic: string,text: string, raw: any= null) {
        return SyncLog.log("info",  topic,text, raw);
    }
    static debug(topic: string,text: string, raw: any= null) {
        return SyncLog.log("debug",  topic,text, raw);
    }
    static verbose(topic: string,text: string, raw: any= null) {
        return SyncLog.log("verbose",  topic,text, raw);
    }

    
    static log(severity: string,  topic: string,text: string, raw: any= null) {
        let time = new Date().getTime();
        let date = new Date(time).toISOString();

        
        if(SyncLog.consoleDebug || severity == "critical"){
            console.log(date + "  -  " +severity + " " + topic +"  -  " + text);
            if(raw){
                console.log(JSON.stringify(raw,null,2));
            }
            
        }

        
        if (SyncLog.instance) {
            
            let id = SyncLog.instance.pushMessage( time, severity,topic, text,  raw);
            return id;
        } else {
            return -1;
        }
    }

    constructor() {
        super("log");
        this.setState({logList:[],lastLogId:0})
        SyncLog.consoleDebug = false;
        SyncLog.instance = this;

    }

    setOutput(active:boolean){
        SyncLog.consoleDebug = active;
    }

    private static logFile = "";
    private static consoleDebug = false;
    

    limitHistory = 200;
    limitHistoryMem = 20000;
    logHistory = [];
    lastLogId = 0;
    
    async getSearch(search:any){
        // TODO search full History
        return {}

    }
    

    readState(objectId) {
        objectId = "" + objectId;
        if (!this.startReadState(objectId)) {
            return;
        }
        this.endReadState(objectId, { logList: [] });
    }
    pushMessage(time:number, severity: string, topic: string, text: string,  raw: any) {
        let id = this.lastLogId++;
            let message = {
                id:id,
                time: time,
                severity,
                text,
                topic,
                raw,
            };

            let state = this.getStateCopy();

            this.logHistory.push(message);
            if (this.logHistory.length > this.limitHistoryMem) {
                this.logHistory.shift();
            }
            state.logList.push(message);
            if (state.logList.length > this.limitHistory) {
                state.logList.shift();
            }

            state.lastLogId = message.id;

            this.setState(state);
        return id;
    }
}

export class LoggedError extends Error {
    constructor(msg: string, logId:number|string = "") {
        super(msg);

        this.logId = ""+logId
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, LoggedError.prototype);
    }
    logId:string = "";
}
