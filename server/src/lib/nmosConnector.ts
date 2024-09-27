/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
*/

import * as WebSocket from "ws";
import axios from "axios";
import { SyncObject } from "./SyncServer/syncObject";
import { Subject } from "rxjs";

import { setTimeout as sleep } from 'node:timers/promises'

import { LoggedError, SyncLog } from "./syncLog";

import {MdnsService} from "./mdnsService"

import * as jsonpatch from 'fast-json-patch';


import * as sdpTransform from 'sdp-transform';
import { CrosspointAbstraction, CrosspointConnectionSenderInfo } from "./crosspointAbstraction";
import { Topology } from "./topology";

const fs = require("fs");



export class NmosRegistryConnector {
    private logReset = true;
    static instance:null|NmosRegistryConnector = null;
    public syncNmos: SyncObject;
    public syncConnectionState: SyncObject;

    public static registerHook(type:"nodes"|"devices"|"flows"|"senders"|"receivers"|"sources"|"sendersManifestDetail", callback: (id:string, data:any) => any){
        this.hookCallbackList[type].push(callback);
        if(NmosRegistryConnector.instance){
            Object.keys(NmosRegistryConnector.instance.nmosState[type]).forEach((item)=>{
                callback(item, NmosRegistryConnector.instance.nmosState[type][item]);
            });
        }
    }

    public static registerModifier(type:"nodes"|"devices"|"flows"|"senders"|"receivers"|"sources"|"sendersManifestDetail", callback: (id:string, data:any) => any){
        this.modifierCallbackList[type].push(callback);
    }

    static hookCallbackList = {
        "nodes" : [],
        "devices" : [],
        "sources" : [],
        "senders" : [],
        "receivers" : [],
        "flows" : [],
        "sendersManifestDetail":[]
    }

    static modifierCallbackList = {
        "nodes" : [],
        "devices" : [],
        "sources" : [],
        "senders" : [],
        "receivers" : [],
        "flows" : [],
        "sendersManifestDetail":[]
    }

    constructor(loaddev = false) {
        NmosRegistryConnector.instance = this;
        this.syncNmos = new SyncObject("nmos", this.nmosState);
        this.syncConnectionState = new SyncObject("nmosConnectionState");

        let settings: any = { staticNmosRegistries: [] };
        try {
            let rawFile = fs.readFileSync("./config/settings.json");
            settings = JSON.parse(rawFile);
        } catch (e) {}

        this.registryVersionList = settings.nmos.registryVersions;
        this.connectVersionList = settings.nmos.connectVersions

        // TODO dev cleanup
        //if(loaddev){
        if(false){
            try {
                let rawFile = fs.readFileSync("./state/devnmosstate/devnmosstate.json");
                let nmosDev = JSON.parse(rawFile);

                for(let type in nmosDev){
                    for(let path in nmosDev[type]){
                        let postData = nmosDev[type][path];
                            NmosRegistryConnector.modifierCallbackList[type].forEach((f)=>{
                                postData = f(path, postData);
                            })
                            this.nmosState[type][path] = postData;
                            NmosRegistryConnector.hookCallbackList[type].forEach((f)=>{
                                f(path, postData);
                            })
                    }
                }

            } catch (e) {}
            this.syncNmos.setState(this.nmosState);
            this.updateCrosspoint();
        }
        // ----- dev cleanup

        
        settings.staticNmosRegistries.forEach((staticRegistry) => {
            try {
                let registry: NmosRegistry = {
                    ip: staticRegistry.ip,
                    port: staticRegistry.port,
                    priority: staticRegistry.priority,
                    source: "static",
                    domain: staticRegistry.domain,
                };
                this.addRegistry(registry);
                SyncLog.log("info","NMOS Settings","Adding Static Registry: "+ JSON.stringify(staticRegistry) );
            } catch (e) {
                SyncLog.log("error","NMOS Settings","Can not add Static Registry: "+ JSON.stringify(staticRegistry) );
            }
        });
    


        setTimeout(()=>{
            this.mdnsQuery();
        },5000);
        this.mdnsQueryInterval = setInterval(() => {
            this.mdnsQuery();
        }, 20000);

        MdnsService.registerHook((response) => {
            response.answers.forEach((answer) => {
                
                if (answer.name == "_nmos-registration._tcp.local") {
                    let registry: NmosRegistry = { ip: "0.0.0.0", port: 0, priority: 1000, source: "mdns", domain: "" };
                    response.additionals.forEach((element) => {
                        if (element.type == "A") {
                            registry.ip = element.data;
                        }
                        if (element.type == "SRV") {
                            registry.port = element.data.port;
                            registry.domain = element.data.target;
                        }
                    });
                    if (registry.port != 0 && registry.ip != "0.0.0.0") {
                        this.addRegistry(registry);
                    }
                }
            });
        });
    }

    private mdnsQuery() {
        MdnsService.query({
            questions: [
                {
                    name: "_nmos-registration._tcp.local",
                    type: "PTR",
                    class: "IN",
                },
            ],
        });
    }
    private addRegistry(registry: NmosRegistry) {
        
        let addNew = true;
        let update = -1;

        for (let i = 0; i < this.nmosRegistryList.length; i++) {
            const el = this.nmosRegistryList[i];
            if (el.ip + ":" + el.port == registry.ip + ":" + registry.port) {
                addNew = false;
                if (el.source != "static") {
                    update = i;
                }
            }
        }

        if (addNew) {
            this.nmosRegistryList.push(registry);
            SyncLog.log("info","NMOS Settings","Adding Registry: "+registry.ip + ":"+registry.port );
            this.connectRegistry(registry);

        }

        if (update != -1) {
            this.nmosRegistryList[update] = registry;
        }

        this.updateSyncConnectionState();
    }
    connectRegistry(registry: NmosRegistry) {
        // TODO: disconnects and reconnects

        const url = "http://" + registry.ip + ":" + registry.port + "";
        this.getSubscription(url, "/nodes");
        this.getSubscription(url, "/devices");
        this.getSubscription(url, "/sources");
        this.getSubscription(url, "/senders");
        this.getSubscription(url, "/receivers");
        this.getSubscription(url, "/flows");
    }

    private mdnsQueryInterval = null;
    private mdnsBrowser: any = null;
    private registryVersionList = ["v1.3","v1.2"];
    private connectVersionList = ["v1.1", "v1.0"];
    private nmosRegistryList: NmosRegistry[] = [];


    updateCrosspointTimer:any = null;
    updateCrosspointLimit = 0;
    updateCrosspoint(){
        if(this.updateCrosspointTimer != null){
            if(this.updateCrosspointLimit < 10){
                this.updateCrosspointLimit++;
            }else{
                return;
            }
        }
        if(this.updateCrosspointTimer != null){
            clearTimeout(this.updateCrosspointTimer);
            this.updateCrosspointTimer = null;
        }
        this.updateCrosspointTimer = setTimeout(()=>{
            this.updateCrosspointLimit = 0;
            this.updateCrosspointTimer = null;
            if(CrosspointAbstraction.instance){
                CrosspointAbstraction.instance.updateFromNmos(this.nmosState);
                Topology.instance.updateDevicesFromNmos(this.nmosState);
            }
        },100);
    }

    private nmosState = {
        devices: {},
        sources: {},
        senders: {},
        receivers: {},
        flows: {},
        nodes: {},
        sendersManifestDetail :{}
    };
    private connections = {};


    private getSubscription(nmosRegistryUrl: string, resource: string) {
        this.registryVersionList.forEach((version)=>{
            this.getVersionSubscription(nmosRegistryUrl,resource,version );
        })
    }

    private getVersionSubscription(nmosRegistryUrl: string, resource: string, version:string){
        axios.post(nmosRegistryUrl + "/x-nmos/query/" + version + "/subscriptions", {
            resource_path: resource,
            params: {},
            persist: false,
            max_update_rate_ms: 50,
        }).then((response: any) => {
            this.logReset = true;
            let subscription = response.data;
            let fullResource = nmosRegistryUrl + "_" + resource + "_" + version;
            if (this.connections[fullResource]) {
                this.connections[fullResource].ws.onmessage = (message) => {};
                try{
                    this.connections[fullResource].ws.close();
                }catch(e){}
            }
            this.connections[fullResource] = {
                version,
                subscription,
                ws: new WebSocket(subscription.ws_href),
            };

            this.connections[fullResource].ws.error = () => {
                this.connections[fullResource].ws.onmessage = (message) => {};
            };

            this.connections[fullResource].ws.onclose = () => {
                this.connections[fullResource].ws.onmessage = (message) => {};
                
                SyncLog.log("error",  "NMOS","Closed subscription to Registry: " + nmosRegistryUrl + ", " + resource + ", " + version );
                setTimeout(()=>{
                    this.getVersionSubscription(nmosRegistryUrl,resource,version );
                },1000)
                this.updateSyncConnectionState();
            };
            this.connections[fullResource].ws.onopen = () => {
                this.updateSyncConnectionState();
            };

            this.connections[fullResource].ws.onmessage = (message) => {
                this.updateState(JSON.parse(message.data),version);
            };
            
            SyncLog.log("info",  "NMOS","Subscribed to Registry: " + nmosRegistryUrl + ", " + resource + ", " + version );
        }).catch((error) => {
            
            //console.log(error);
            	setTimeout(()=>{
                    this.getVersionSubscription(nmosRegistryUrl,resource,version );
                },20000)
                if(this.logReset){
                    this.logReset = false;
                    SyncLog.log("error",  "NMOS","Error While creating NMOS Subscription on Registry: " + nmosRegistryUrl + ", " + resource + ", " + version, {message:error.message});
                }
        });
    }

    private versionIsPrefered(oldVersion:string, newVersion:string, registry=true){
        let list = this.registryVersionList;
        if(!registry){
            list = this.connectVersionList
        }
        let newIndex = list.indexOf(newVersion);
        let oldIndex = list.indexOf(oldVersion)
        if(newIndex <= oldIndex){
            return true;
        }
        return false;

    }

    updateNewNmosItemTimer:any|null = null;
    private updateState(message: any, version:string) {
        //console.log("updates from registry: " + message.type)
        let newItem = false;
        let type = "";
        let changes = false;
        let changesConnect = false;
        try {
            type = (message.grain.topic as string).split("/").join("");
        } catch (e) {}
        //console.log("updates from registry: " +  (message.grain.topic as string) + " > " + type)
        if (this.nmosState[type]) {
            //console.log(JSON.stringify(message,null, 2))
            message.grain.data.forEach((g: any) => {
                if (g.hasOwnProperty("path") && typeof g.path == "string") {
                    if (g.hasOwnProperty("post")) {
                        // add or update element
                        if (typeof g.post == "object") {
                            if(this.nmosState[type][g.path] && !this.versionIsPrefered(this.nmosState[type][g.path]["_sourceVersion"], version)){
                                // do not update
                            }else{
                                let postData = g.post;
                                NmosRegistryConnector.modifierCallbackList[type].forEach((f)=>{
                                    postData = f(g.path, postData);
                                })
                                if(this.nmosState[type].hasOwnProperty(g.path)){
                                    //Update
                                }else{
                                    newItem = true;
                                    changes = true;
                                }

                                postData["_sourceVersion"] = version;

                                NmosRegistryConnector.hookCallbackList[type].forEach((f)=>{
                                    f(g.path, postData);
                                })

                                if(!newItem){
                                    let diff = jsonpatch.compare(this.nmosState[type][g.path], postData);
                                    if(diff.length == 0){
                                        // nothing
                                    }else if(diff.length == 1 &&  diff[0].op == "replace" && diff[0].path == "/version"){
                                        // nothing... relevant
                                    }else if(diff.length == 2 && diff[1].op == "replace" && diff[1].path == "/subscription/sender_id" ){
                                        changesConnect = true;
                                        // TODO, isolate changes 
                                        changes = true;
                                    }else{
                                        changes = true;
                                    }
                                    
                                }
                                this.nmosState[type][g.path] = postData;
                                
                            }

                        }
                    } else {
                        // remove element
                        try {
                            if(this.nmosState[type][g.path]["_sourceVersion"] == version){
                                delete this.nmosState[type][g.path];
                                changes = true;
                            }
                        } catch (e) {}
                    }
                }
            });
        }
        // TODO
        //fs.writeFileSync("./state/devnmosstate/devnmosstate.json", JSON.stringify(this.nmosState));
        this.syncNmos.setState(this.nmosState);
        if(newItem){
            if(this.updateNewNmosItemTimer){
                clearTimeout(this.updateNewNmosItemTimer);
            }
            this.updateNewNmosItemTimer = setTimeout(() => {
                this.updateNewNmosItemTimer = null;
                this.updateCrosspoint();
            }, 1000);
            
        }else{
            if(changes){
                if(this.updateNewNmosItemTimer){

                }else{
                    this.updateCrosspoint();
                }
            }
        }

        
                message.grain.data.forEach((g: any) => {

                    console.log( "---- GRAIN: "+type+ "    -----   "+g.post?.label)

                    if (type == "senders" || type == "flows") {
                        setTimeout(()=>{
                            this.getSenderManifestData(type, g);
                        },200)
                    }
                });


        

    }


    getSenderManifestData(type:string, g:any){
        if (g.hasOwnProperty("path") && typeof g.path == "string") {
            if (g.hasOwnProperty("post")) {
                // add or update element
                if (typeof g.post == "object") {

                    let manifest_href = "";
                    let active = false;
                    let senderId = "";
                    let label = "";

                    let source:any = null;
                    try{

                        if (type == "senders") {
                            source = g.post;
                            senderId = g.path;
                        }
                        if (type == "flows") {
                            source = this.nmosState.senders[g.post.source_id];
                            senderId = g.post.source_id;
                        }

                    
                        if(source && source.hasOwnProperty("manifest_href")){
                            manifest_href = source.manifest_href;
                            active = source.subscription?.active;
                            senderId = g.path;
                            label = g.post.label
                        }
                        
                    }catch(e){}

                    if (manifest_href && active && senderId) {
                        console.log("----- load manifest for "+label)
                        axios.get(g.post.manifest_href).then(response => {
                            if(response.data.length > 10){
                                // TODO Check for BAD SDP Files, is this already enough, more than 10 chars and more than 0 flows
                                let sdp = sdpTransform.parse(response.data);
                                sdp["_RAWSDP"] = response.data;
                                if(sdp.media.length == 0){
                                    SyncLog.log("warn", "NMOS", "Got BAD SDP File for Flow: " + label + " ( ID: " + senderId +" )")  
                                    try{
                                        // TODO Test
                                        delete this.nmosState["sendersManifestDetail"][senderId];
                                        this.syncNmos.setState(this.nmosState);
                                    }catch(e){}
                                }else{
                                    this.nmosState["sendersManifestDetail"][senderId] = sdp;
                                    this.syncNmos.setState(this.nmosState);
                                }
                            }else{
                                SyncLog.log("warn", "NMOS", "Got BAD SDP File for Flow: " + label + " ( ID: " + senderId +" )")    
                                try{
                                    // TODO Test
                                    delete this.nmosState["sendersManifestDetail"][senderId];
                                }catch(e){}
                            }
                        }).catch(e=>{
                            SyncLog.log("warn", "NMOS", "Can not get SDP File for Flow: " + label + " ( ID: " + senderId +" )")
                        });
                    }
                }
            } else {
                if (type == "senders") {
                    // remove element
                    try {
                        delete this.nmosState["sendersManifestDetail"][g.path];
                        this.syncNmos.setState(this.nmosState);
                    } catch (e) {}
                    
                }
            }
        }
    }

    updateSyncConnectionState() {
        let list = [];
        this.nmosRegistryList.forEach((registry) => {
            let entry:any = structuredClone(registry);
            //let entry = JSON.parse(JSON.stringify(registry));
            entry.connected = [];
            try {
                const url = "http://" + registry.ip + ":" + registry.port + "";
                let endpoints = ["nodes", "devices", "sources", "senders", "receivers", "flows"];
                endpoints.forEach((e) => {
                    Object.keys(this.connections).forEach((c)=>{
                        if(c.startsWith(url + "_/" + e )){
                            if (this.connections[c].ws.readyState == WebSocket.OPEN) {
                                entry.connected.push({endpoint:e, version:this.connections[c].version, connected:true});
                            }else{
                                entry.connected.push({endpoint:e, version:this.connections[c].version, connected:false});
                            }
                        }
                    })
                });
            } catch (e) {}
            list.push(entry);
        });
        this.syncConnectionState.setState({ registries: list });
        setTimeout(()=>{
            this.updateSyncConnectionState();
        },2000)
    }


    async connectionGetSenderInfo(senderId:string){
        let info:CrosspointConnectionSenderInfo = {
            senderId: senderId,
            interfaces:[],
            manifestFile:"",
            active:false,
            error:"",
            transport:""
        }
        let deviceId
        let device 
        let nodeId 
        let node 
        let flowId
        let sender
        let flow 
        let manifest
        try{
            sender = this.nmosState.senders[senderId]
            flowId = sender.flow_id
            deviceId = sender.device_id;
            device = this.nmosState.devices[deviceId];
            nodeId = device.node_id;
            node = this.nmosState.nodes[nodeId];
        }catch(e){
            info.error = "Sender not available in NMOS";
            return info;
        }

        // TODO: need to load manifest always
        // Now: Always load manifest
        //if(this.nmosState.sendersManifestDetail.hasOwnProperty(senderId)){
        //    manifest = this.nmosState.sendersManifestDetail[senderId]
        //    info.manifestFile = manifest._RAWSDP;
        //}else{
            // Load manifest
            try{
                let sdp = await axios.get(sender.manifest_href)
                info.manifestFile = sdp.data;
            }catch(e){
                info.error = "Can not load Manifest from sender: " + e.code;
                return info;
            }
        //}

        sender.interface_bindings.forEach((name:any)=>{
            node.interfaces.forEach((inter:any)=>{
                if(inter.name == name){
                    info.interfaces.push({name:name,mac:inter.port_id});
                }
            })
        });

        if(sender.transport == "urn:x-nmos:transport:rtp.mcast"){
            info.transport = "rtp.mcast"
        }
        if(sender.transport == "urn:x-nmos:transport:rtp"){
            info.transport = "rtp"
        } 

        info.active = sender.subscription.active;

        return info
    }

    async makeConnection(receiverId:string, senderInfo: CrosspointConnectionSenderInfo){

        if(senderInfo.error != ""){
            SyncLog.log("warning", "NMOS Connect", "No valid sender Info: " + senderInfo.error);
            throw new Error(senderInfo.error);
        }

        let patch: any = {
            activation: { mode: "activate_immediate" },
            transport_params: [],
        };

        

        if(senderInfo.senderId == "disconnect"){
            //
        }else{
            patch.sender_id = senderInfo.senderId;
        }

        let deviceId
        let device 
        let nodeId 
        let node 
        let receiver
        try{
            receiver = this.nmosState.receivers[receiverId]
            deviceId = receiver.device_id;
            device = this.nmosState.devices[deviceId];
            nodeId = device.node_id;
            node = this.nmosState.nodes[nodeId];
        }catch(e){
            SyncLog.log("warning", "NMOS Connect", "Receiver with ID: "+receiverId+" is not available in NMOS");
            throw new Error("NMOS: Receiver not available. (Offline?)");
        }

        let interfaces = [];
        receiver.interface_bindings.forEach((name:any)=>{
            node.interfaces.forEach((inter:any)=>{
                if(inter.name == name){
                    interfaces.push({name:name,mac:inter.port_id});
                }
            })
        });

        


        let interfaceCount = Math.min(senderInfo.interfaces.length, interfaces.length);
        let i = 0;

        for (i = 0; i < interfaceCount; i++) {
            if(senderInfo.transport == "rtp.mcast" || senderInfo.transport == "rtp"){
                patch.transport_params.push({interface_ip:"auto",rtp_enabled:true});
            }else if(senderInfo.transport == "websocket"){
                // TODO Websocket / MQTT
                patch.transport_params.push({});
            }else if(senderInfo.transport == "mqtt"){
                // TODO Websocket / MQTT
                patch.transport_params.push({});
            }else{
                SyncLog.log("warning", "NMOS Connect", "Sender has no transport Information.");
                throw new Error("Transport Type missing.");
            }
        }

        interfaceCount = receiver.interface_bindings.length;
        for (i = i; i < interfaceCount; i++) {
            if(senderInfo.senderId == "disconnect"){
                patch.transport_params.push({ rtp_enabled: false });
            }else{
                patch.transport_params.push({});
            }
        }

        if(senderInfo.transport == "rtp.mcast" || senderInfo.transport == "rtp"){
            patch.transport_file = {
                type: "application/sdp",
                data: senderInfo.manifestFile,
            };
        }

        if(senderInfo.senderId == "disconnect"){
            patch.master_enable = false;
        }else{
            patch.master_enable = true;
        }
        // Warum ????

        //if (receiver.subscription.active) {
        //if (!receiverInformation.active.master_enable) {
            //if(senderInfo.senderId == "disconnect"){
            //    patch.master_enable = false;
            //}else{
            //
            //}
        //}else{
            //if(senderInfo.senderId == "disconnect"){
            //    
            //}else{
            //    patch.master_enable = true;
            //}
        //}

        let versionFound = false;
        let controlHrefs = [];
        let controlTypes = [{type:"urn:x-nmos:control:sr-ctrl/v1.1",version:"v1.1"}, {type:"urn:x-nmos:control:sr-ctrl/v1.0",version:"v1.0"}]

        for(let type of controlTypes){
            device.controls.forEach((control)=>{
                if(control.type == type.type){
                    controlHrefs.push({href:control.href, version:type.version});
                    versionFound = true;
                }
            })
            if(versionFound){
                break;
            }
        }

        let done = false;

        // TODO Check control hrefs for first response....

        for(let href of controlHrefs){
            // TODO, version specific things
            let fixSlash = ""
            if(href.href[href.href.length-1] == "/"){
                fixSlash = ""
            }else{
                fixSlash = "/"
            }
            let patchHref = href.href + fixSlash + "single/receivers/" + receiverId + "/staged"
            try{
                let result = await axios.patch(patchHref, patch, {timeout:30000});
                return SyncLog.log("success", "nmos_connect", "Successfully patched: "+receiverId, {href:patchHref, data:patch})
            }catch(e){
                if (axios.isAxiosError(e)) {
                    if(e.code == "ETIMEDOUT"){
                        // NEXT
                        let id = SyncLog.log("info", "nmos_connect", "Patch on "+patchHref+" timed out, trying next.");
                    }else{
                        // TODO....
                        if(e.code == "ERR_BAD_REQUEST"){
                            let id = SyncLog.log("error", "nmos_connect", "Receiver "+receiverId+" returned Error: "+e.code,{controlHrefs,failedControl:patchHref,patch, error:e.response.data,});
                            throw new LoggedError("Patch failed: "+e.response.data.error + " / " +e.response.data.debug , id);
                        }
                        let id = SyncLog.log("error", "nmos_connect", "Receiver "+receiverId+" returned Error: "+e.code,{controlHrefs,failedControl:patchHref,patch, message:e.message});
                        throw new LoggedError("Receiver returned Error: "+e.code, id);
                    }
                }else{
                    throw new LoggedError("Patch Failed: "+e.message);
                }
                
            }
        }
        let id = SyncLog.log("error", "nmos_connect", "Receiver Control unreachable.",{controlHrefs,patch});
        throw new LoggedError("Receiver Control unreachable.", id);
    }


    private getOne(hrefList: string[]) {
        return new Promise((resolve, reject) => {
            let promises = [];
            hrefList.forEach((href) => {
                promises.push(axios.get(href));
                axios.get(href).then(response=>{
                
                }).catch(e=>{
                    // TODO Logging
                    //console.log(e)
                });
            });
            
            Promise.any(promises)
                .then((response) => {
                    resolve(response);
                })
                .catch((error) => {
                    // TODO: Logging
                    //console.log(error);
                    reject(error);
                });
        });
    }
}

interface Connection {
    subscription: any;
    ws: WebSocket;
}

interface NmosRegistry {
    ip: string;
    port: number;
    domain: string;
    priority: number;
    source: "mdns" | "static";
}

interface ConnectionList {
    [name: string]: Connection;
}

interface CrosspointList {
    [name: string]: any;
}
export interface CrosspointState {
    [name: string]: CrosspointList;
}



interface CrosspointSender {
    name:string;
    type:string;
    resolution:string;
}



