import { SyncObject } from "./SyncServer/syncObject";
import { LoggedError, SyncLog } from "./syncLog";
import { error } from "console";
import { NmosRegistryConnector } from "./nmosConnector";

import { setTimeout as sleep } from 'node:timers/promises'


const { Worker } = require('worker_threads');

const crypto = require('crypto');


const fs = require("fs");
const md5 = data => crypto.createHash('md5').update(data).digest("hex")

 export class CrosspointAbstraction {
    public static instance: CrosspointAbstraction | null;

    public syncCrosspoint: SyncObject;
    crosspointState: CrosspointState = {devices:[]};

    worker;

    startWorker(){
        SyncLog.info("crosspoint", "Starting Worker thread.");
        this.worker = new Worker(__dirname + '/crosspointUpdateThread.js');
        this.worker.on('message', (message)=>{
            let data = JSON.parse(message);
            this.updateReturn(data);
        });
        this.worker.on('error', (error)=>{
            SyncLog.error("crosspoint", "Error in Worker Thread: "+ error.message, error);
            // TODO crash on remote system "Error in Worker Thread: Cannot read properties of null (reading 'devices')" Analyze
        });

        this.worker.on('exit', (code)=>{
            if(code == 0){
                SyncLog.info("crosspoint", "Worker Thread exit with code: "+ code);
            }else{
                SyncLog.error("crosspoint", "Worker Thread exit with code: "+ code);
                setTimeout(()=>{this.startWorker()},1000);
            }
        });
    }

    constructor(){

        this.startWorker();

        


        if(CrosspointAbstraction.instance == null){
            CrosspointAbstraction.instance = this;
        }
        this.syncCrosspoint = new SyncObject("crosspoint", this.crosspointState);
        this.update();
    }

    nmosState : any = null;

    getFlowInfo(flowId:string){
        try{
            let manifest:any = null;
            if(flowId.startsWith("nmos_")){
                let id = flowId.slice(5);
                manifest = this.nmosState.sendersManifestDetail[id];
            }
            for(let dev of this.crosspointState.devices){
                for(let type of Object.keys(dev.senders)){
                    for( let flow of dev.senders[type]){
                        if(flow.id == flowId){
                            return {
                                flow: flow,
                                manifest: manifest
                            };
                        }
                    }
                }
            }
        }catch(e){}
        return null;
    }

    changeAlias(id:string, alias:string){
        return new Promise((resolve, reject) => {
            this.worker.postMessage(JSON.stringify({
                changeAlias:{id:id, alias:alias}
            }));
            resolve({});
        });
    }

    toggleHidden(id:string){
        return new Promise((resolve, reject) => {
            this.worker.postMessage(JSON.stringify({
                toggleHidden:{id:id}
            }));
            resolve({});
        });
    }

    makeConnection(data:any){
        return new Promise(async(resolve, reject) => {

            let preview = true;
            let prepare = false;
            let list = [];
            if(data.hasOwnProperty("multiple")){
                list = data.multiple;
            }else{
                if(data.hasOwnProperty("source") && data.hasOwnProperty('destination')){
                    list = [{source:data.source+"", destination:data.destination+""}]
                }
            }

            if(data.hasOwnProperty("preview") && data.preview === false){
                preview = false;
            }
            if(data.hasOwnProperty("prepare") && data.prepare === true){
                prepare = true;
                preview = false;
            }


            let connections = [];


            list.forEach((c)=>{
                let source = c.source+""
                let destination = c.destination+""
                let disconnect = false
                if(source == ""){
                    // Disconnect
                    disconnect = true
                }

                let srcFlows:any[] = [];
                let dstFlows:any[] = [];

                // Select all source Flows
                let sourceDevice = null;
                let sourceDeviceOnly = false;
                let sourceFlowType = "";
                let sourceFlow = null;
                let sourceParts = source.split(".");
                let srcDev = null
                sourceDevice = sourceParts[0]
                if(sourceParts.length == 2){
                    sourceFlow = sourceParts[1].slice(1);
                    switch(sourceParts[1][0]){
                        case "v":
                            sourceFlowType = "video"
                            break;
                        case "a":
                            sourceFlowType = "audio"
                            break;
                        case "d":
                            sourceFlowType = "data"
                            break;
                        default:
                            sourceFlowType = "unknown"
                    }
                }else{
                    sourceDeviceOnly = true;
                }

                for(let dev of this.crosspointState.devices){
                    if(dev.num == sourceDevice){
                        srcDev = dev;
                        for(let type in dev.senders){
                            if(type == sourceFlowType || sourceDeviceOnly){
                                for(let flow of dev.senders[type]){
                                    if(flow.num == sourceFlow || sourceDeviceOnly){
                                        srcFlows.push(flow);
                                    }
                                }
                            }
                        }
                    }
                }


                // Select all destination Flows
                let destinationDevice = null;
                let destinationDeviceOnly = false;
                let destinationFlowType = "";
                let destinationFlow = null;
                let destinationParts = destination.split(".");
                let dstDev = null;
                destinationDevice = destinationParts[0]
                if(destinationParts.length == 2){
                    destinationFlow = destinationParts[1].slice(1);
                    switch(destinationParts[1][0]){
                        case "v":
                            destinationFlowType = "video"
                            break;
                        case "a":
                            destinationFlowType = "audio"
                            break;
                        case "d":
                            destinationFlowType = "data"
                            break;
                        default:
                            destinationFlowType = "unknown"
                    }
                }else{
                    destinationDeviceOnly = true;
                }

                for(let dev of this.crosspointState.devices){
                    if(dev.num == destinationDevice){

                        dstDev = dev;
                        for(let type in dev.receivers){
                            if(type == destinationFlowType || destinationDeviceOnly){
                                for(let flow of dev.receivers[type]){
                                    if(flow.num == destinationFlow || destinationDeviceOnly){
                                        dstFlows.push(flow);
                                    }
                                }
                            }
                        }
                    }
                }


                //console.log("Sources:", srcFlows)
                //console.log("Destiantions:", dstFlows)
                if((srcFlows.length > 0 || disconnect) && dstFlows.length > 0){
                    
                        // Connection Matcher

                        // For Each dstFlow
                        //      find suitable SrcFlow
                        //      Type
                        //      Capabilities
                        //      Lowest NUM

                        let usedSources = [];

                        for(let dstFlow of dstFlows){
                            let connection = {src:null,srcDev:srcDev, dst:dstFlow,dstDev:dstDev}

                            if(disconnect){
                                // src : null
                            }else{
                                for(let srcFlow of srcFlows){
                                    // TODO websocket/mqtt flwos interop
                                    let connect = false;
                                    if(dstFlow.type == "audio" && srcFlow.type == "audio"){
                                        // TODO check for capabilities
                                        connect = true;
                                    }else if(dstFlow.type == "video" && srcFlow.type == "video"){
                                        // TODO check for capabilities
                                        connect = true;
                                    }else if(dstFlow.type == "data"){
                                        if(srcFlow.type == "data"){
                                            // TODO check for capabilities
                                            connect = true;
                                        }
                                    }else{
                                        if(dstFlow.type == srcFlow.type){
                                            connect = true;
                                        }
                                    }

                                    if(connect && !usedSources.includes(srcFlow.id)){
                                        if(connection.src == null){
                                            connection.src = srcFlow;
                                            usedSources.push(srcFlow.id);
                                        }else if(connection.src.num > srcFlow.num){
                                            usedSources = usedSources.filter((s)=>{
                                                if(s.id == connection.src.id){
                                                    return false;
                                                }else{
                                                    return true;
                                                }
                                            })
                                            connection.src = srcFlow;
                                        }
                                    }
                                
                            }
                            }
 
                            connections.push(connection);
                        }
                }

            });



            if(preview){
                let connectionPreviews = [];
                connections.forEach((c)=>{
                    connectionPreviews.push({src:(c.src?c.src.id:null),dst:c.dst.id, status:"preview"});
                });
                resolve({connections:connectionPreviews});
            }else if(prepare){
                let connectionPreviews = [];
                connections.forEach((c)=>{
                    connectionPreviews.push({src:c.src,dst:c.dst,srcDev:(c.src ? c.srcDev : null), dstDev:c.dstDev, status:"prepare"});
                });
                resolve({connections:connectionPreviews});
            }else{
                let connectionPromises = [];
                let disconnectPromises = [];
                let connectionResponses = [];

                // Connects
                connections.forEach((c)=>{
                    if(c.src){
                        connectionPromises.push(this.executeConnection(c.src,c.dst));
                    }
                });
                
                let results = await Promise.allSettled(connectionPromises);
                results.forEach((r)=>{
                    if(r.status == "fulfilled"){
                        connectionResponses.push(r.value);
                    }else{
                        connectionResponses.push(r.reason);
                    }
                })


                // Dsiconnects
                connections.forEach((c)=>{
                    if(!c.src){
                        disconnectPromises.push(this.executeConnection(c.src,c.dst));
                    }
                });
                results = await Promise.allSettled(disconnectPromises);
                results.forEach((r)=>{
                    if(r.status == "fulfilled"){
                        connectionResponses.push(r.value);
                    }else{
                        connectionResponses.push(r.reason);
                    }
                })

                resolve({connections:connectionResponses});
            }

            // Further TODOs
            // Get Source Info
            // SDP
            // Bitrate
            // Interfaces

            // Transform

            // Check Network
            // Check other ???

            // Send to destiantion (if not preview)
           
            
        });

    }


    executeConnection(src:CrosspointFlow,dst:CrosspointFlow){
        return new Promise(async(resolve, reject) => {
            if(dst){
                let senderInfo:CrosspointConnectionSenderInfo|null = null;
                if(src){
                    SyncLog.log("info", "connect_crosspoint", "Make Connect: Receiver "+ dst.id + "    <   Sender " + src.id)
                    try{
                        if(src.id.startsWith("nmos_")){
                            let nmosId = src.id.slice(5);
                            senderInfo = await NmosRegistryConnector.instance.connectionGetSenderInfo(nmosId);
                        }
                        
                    }catch(e){
                        reject({src:src,dst:dst,status:"failed sender info"});
                    }
                }else{
                    SyncLog.log("info", "connect_crosspoint", "Make Connect: Receiver "+ dst.id + "    <   Disconnect")
                    senderInfo = {
                        senderId: "disconnect",
                        interfaces:[],
                        manifestFile:"",
                        active:false,
                        error:"",
                        transport:""
                    }
                }

                // TODO handle inactive Sender


                    
                if(dst.id.startsWith("nmos_")){
                    try{
                        let nmosId = dst.id.slice(5);
                        let log = await NmosRegistryConnector.instance.makeConnection(nmosId,senderInfo);
                        if(senderInfo.senderId == "disconnect"){
                            resolve({src:src,dst:dst,status:"ok_dis", detail:{message:"Success",log:""+log}});
                        }else{
                            resolve({src:src,dst:dst,status:"ok", detail:{message:"Success",log:""+log}});
                        }
                    }catch(e){
                        if(e instanceof LoggedError){
                            reject({src:src,dst:dst,status:"failed", detail:{message:e.message, log:e.logId}});
                        }else{
                            reject({src:src,dst:dst,status:"failed", detail:{message:e.message, log:""}});
                        }
                        
                    }
                }
            }else{
                let id = SyncLog.log("warning", "connect_crosspoint", "Connect command without destination.")
                reject({src:src,dst:dst,status:"nc", detail:{message:"Destination missing",log:id}});
            }
        });
    }

    updateFromNmos(state:any){
        this.nmosState = state;
        this.update();
    }

    update(){
        this.worker.postMessage(JSON.stringify({
            nmosState:this.nmosState,
        }))
    }

    updateReturn(data:any){
        if(data.hasOwnProperty("crosspointState")){
            this.crosspointState = data.crosspointState;
            this.syncCrosspoint.setState(this.crosspointState);
        }

        if(data.hasOwnProperty("log")){
            SyncLog.log(data.log.severity, data.log.topic, data.log.text, data.log.raw);
        }
    }

    
    
}


export interface CrosspointEndpoint {
    type: "flow" | "device" | "channel",
    id: string
};

export interface CrosspointCapabilities {
    mediaTypes:string[],
    transport:string,
    dash7:boolean
};

export interface CrosspointFlowBitrate {
    v:number,
    hint:string
}


export interface CrosspointFlow {
    id:string,
    order : number,
    available:boolean,
    active:boolean,
    num:number,
    name:string,

    alias:string,
    hidden:boolean,

    connectedFlow:string,

    type:"video" | "audio" | "data" | "mqtt" | "websocket" | "audiochannel" | "unknown",
    format: string,
    manifestOk:boolean,
    capabilities:CrosspointCapabilities,
    capLimits:string,
    channelNumber: number,
    sourceNumber: number,
    bitrate:CrosspointFlowBitrate
};



export interface CrosspointDevice {
    id:string,
    order:number,
    available:boolean,
    num:number,
    name:string,
    ip:string,
    alias:string,
    hidden:boolean,
    senderIds:string[],
    receiverIds:string[],
    connectedFlows:string[],

    senders:  {
        audio: CrosspointFlow[],
        audiochannel:CrosspointFlow[],
        video: CrosspointFlow[],
        data: CrosspointFlow[],
        websocket:CrosspointFlow[],
        mqtt: CrosspointFlow[],
        unknown: CrosspointFlow[],
    },
    receivers:  {
        audio: CrosspointFlow[],
        audiochannel:CrosspointFlow[],
        video: CrosspointFlow[],
        data: CrosspointFlow[],
        websocket:CrosspointFlow[],
        mqtt: CrosspointFlow[],
        unknown: CrosspointFlow[],
    },
    
  }
export interface CrosspointState {
    devices: CrosspointDevice[]
}


export interface CrosspointShadowFlow {
    id:string,
    num:number,
    order : number,
    name:string,
    type:"video" | "audio" | "data" | "mqtt" | "websocket" | "audiochannel" | "unknown",
    channelNumber: number,
};

export interface CrosspointConnectionSenderInfo {
    senderId:string,
    manifestFile:string,
    interfaces:any[],
    active:boolean,
    error:string,
    transport:string
}

export interface CrosspointShadowDevice {
    id:string,
    num:number,
    order:number,
    name:string,
    senders:  {
        audio: { [name: string]: CrosspointShadowFlow },
        audiochannel: { [name: string]: CrosspointShadowFlow },
        video: { [name: string]: CrosspointShadowFlow },
        data: { [name: string]: CrosspointShadowFlow },
        websocket: { [name: string]: CrosspointShadowFlow },
        mqtt: { [name: string]: CrosspointShadowFlow },
        unknown: { [name: string]: CrosspointShadowFlow },
    },
    receivers:  {
        audio: { [name: string]: CrosspointShadowFlow },
        audiochannel: { [name: string]: CrosspointShadowFlow },
        video: { [name: string]: CrosspointShadowFlow },
        data: { [name: string]: CrosspointShadowFlow },
        websocket: { [name: string]: CrosspointShadowFlow },
        mqtt: { [name: string]: CrosspointShadowFlow },
        unknown: { [name: string]: CrosspointShadowFlow },
    },
    
  }
export interface CrosspointShadowState {
    devices: {
        [name: string]: CrosspointShadowDevice
    }

}


