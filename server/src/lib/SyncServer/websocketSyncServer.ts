/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
*/

import * as cluster from "cluster";
import * as WebSocket from "ws";

var path = require("path");

const express = require("express");

import { WebsocketClient } from "./websocketClient";
import { SyncObject } from "./syncObject";
import { SyncLog } from "../syncLog";

interface SyncObjectList {
    [key: string]: SyncObject;
}

export class WebsocketSyncServer {
    public static init(address:string, port:number) {
        WebsocketSyncServer.instance = new WebsocketSyncServer(address,port);
    }

    authData:any = {
        "users":[],
        "permissions":{
            "global":{
                "allowRead":{"users":[],"groups":[]},
                "allowWrite":{"users":[],"groups":[]},
                "denyRead":{"users":[],"groups":[]},
                "denyWrite":{"users":[],"groups":[]}
            }
        }
    }
    public relaodAuthData(data:any){
        this.authData = data;
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

    public addRoute(method, route, permission, func) {
        this.routeList[method + "_" + route] = {func,permission};
    }
    public request(message, client: WebsocketClient) {
        return new Promise((resolve, reject) => {
            let route = message.route.split("/");
            let routeBase = route[0];
            let query = route.splice(1);
            if (this.routeList.hasOwnProperty(message.method + "_" + routeBase)) {
                // TODO Check Permission
                if(this.checkPermission(client.user, this.routeList[message.method + "_" + routeBase].permission, (message.method =="GET" ? false:true))){
                    this.routeList[message.method + "_" + routeBase].func(client, query, message.data)
                    .then((data) => {
                        resolve({
                            type: "response",
                            method: message.method,
                            id: message.id,
                            status: data["status"] ? data["status"] : 200,
                            message: data["message"] ? data["message"] : "ok",
                            data: data["data"] ? data["data"] : {},
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
                }else{
                    reject({
                        type: "response",
                        method: message.method,
                        id: message.id,
                        status: 403,
                        message: "permission denied",
                        error:  {},
                    });
                }
                
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

    public addSyncObject(route, permission, syncObject: SyncObject) {
        this.syncObjectList[route] = syncObject;
        syncObject.name = route;
        syncObject.requiredPermission = permission;
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
            if(this.checkPermission(client.user,this.syncObjectList[name].requiredPermission,false)){
                this.syncObjectList[name].subscribe(client, objectId);
            }else{
                client.sendPermissionDenied("sync",{name,objectId});
            }
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

    private constructor(address:string, port:number) {
        this.wss = new WebSocket.Server({ noServer: true });
        this.wss.on("connection", (ws) => {
            
            const client = new WebsocketClient(ws, {});
            this.clientList.push(client);
            SyncLog.log("verbose", "Server", "New Client connected", {env:client.getEnv} );
        });

        this.server = express();
        this.server.use("/*", (req, res, next) => {
            //res.setHeader("Cache-Control", "must-revalidate"); 
            //res.setHeader("service-worker-allowed", "/"); 
            next();
        });
        this.server.use("/assets/connectionWorker.js", (req, res, next) => {
            res.setHeader("service-worker-allowed", "/"); 
            next();
        });
        this.server.use(express.static("./public"));
        this.server.all("/*", function (req, res, next) {
            res.sendFile(path.resolve("./") + "/public/index.html");
        });

        const ls = this.server.listen(port, address, (e) => {
            SyncLog.log("error", "Server", "Failed to start on: "+address+":"+port, e )
        },() => {
            SyncLog.log("info", "Server", "Listening to: "+address+":"+port )
        });

        ls.on("upgrade", (request, socket, head) => {
            this.wss.handleUpgrade(request, socket, head, (socket) => {
                this.wss.emit("connection", socket, request);
            });
        });
    }


     public checkPermission(user:string,required:string, write:boolean){
        
        try{
            let permis = this.authData.permissions[required];

            let groups = [];
            if(user!="__noAuth"){
                groups = this.authData.users[user].groups;
            }

            if(write){
                if( permis.denyWrite.users.includes(user) || permis.denyWrite.groups.some((v)=>groups.includes(v))){
                    return false;
                }
                if( permis.allowWrite.users.includes(user) || permis.allowWrite.groups.some((v)=>groups.includes(v))){
                    return true;
                }
            }else{
                if( permis.denyRead.users.includes(user) || permis.denyRead.groups.some((v)=>groups.includes(v))){
                    return false;
                }
                if( permis.allowRead.users.includes(user) || permis.allowRead.groups.some((v)=>groups.includes(v))){
                    return true;
                }
            }
            
        
        }catch(e){
            console.log(e)
        }
        return false;
     }
}
