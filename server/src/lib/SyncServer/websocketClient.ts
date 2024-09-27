/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
*/

import * as WebSocket from "ws";

import * as Crypto from "crypto";

import { WebsocketSyncServer } from "./websocketSyncServer";

export class WebsocketClient {
    private ws: WebSocket;

    private authSeed: string = "";
    public user: string = "__noAuth"
    public sendPermissionDenied(type:string, data:any){
        this.send({
            type:"permissionDenied",
            requestType:type,
            data:data
        })
    }


    private env = {};
    public getEnv() {
        return this.env;
    }

    private subscriptionList = [];

    constructor(s: WebSocket, e: any) {
        this.ws = s;
        this.env = e;

        this.authSeed = Crypto.createHash('sha1').update(""+Math.random()).digest('hex');

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
        try{
            this.ws.send(JSON.stringify({
                type:"authseed",
                seed:this.authSeed
            }));
        }catch(e){}
    }

    destructor() {}
    isConnected() {
        return !this.ws.CLOSED;
    }

    private send(obj) {
        try{
            if (this.ws.OPEN) {
                this.ws.send(JSON.stringify(obj));
            }
        }catch(e){}
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
            case "auth":
                this.processAuth(message);
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

    
    processAuth(message:any){
        if(WebsocketSyncServer.getInstance().authData.users.hasOwnProperty(message.user)){
            let proof = WebsocketSyncServer.getInstance().authData.users[message.user].password + this.authSeed
            proof = Crypto.createHash('sha256').update(proof).digest('hex');

            if(proof == message.password){
                this.user = message.user;
                this.send({type:"auth", user:message.user});
            }else{
                this.send({type:"authfailed"});
            }
        }else{
            this.send({type:"authfailed"});
        }
    }
}
