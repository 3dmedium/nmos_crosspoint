/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
*/

import WebSocket from "ws";
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
                if(NmosRegistryConnector.instance){
                    callback(item, NmosRegistryConnector.instance.nmosState[type][item]);
                }
            });
        }
    }

    public static registerModifier(type:"nodes"|"devices"|"flows"|"senders"|"receivers"|"sources"|"sendersManifestDetail", callback: (id:string, data:any) => any){
        this.modifierCallbackList[type].push(callback);
    }

    static hookCallbackList:any = {
        "nodes" : [],
        "devices" : [],
        "sources" : [],
        "senders" : [],
        "receivers" : [],
        "flows" : [],
        "sendersManifestDetail":[]
    }

    static modifierCallbackList:any = {
        "nodes" : [],
        "devices" : [],
        "sources" : [],
        "senders" : [],
        "receivers" : [],
        "flows" : [],
        "sendersManifestDetail":[]
    }

    settings:any = {};

    constructor(config:any, loaddev = false) {
        this.settings = config;
        NmosRegistryConnector.instance = this;
        this.syncNmos = new SyncObject("nmos", this.nmosState);
        this.syncConnectionState = new SyncObject("nmosConnectionState");

        this.registryVersionList = this.settings.nmos.registryVersions;
        this.connectVersionList = this.settings.nmos.connectVersions

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

        
        this.settings.staticNmosRegistries.forEach((staticRegistry) => {
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

    private mdnsQueryInterval:NodeJS.Timeout|null = null;
    private mdnsBrowser: any = null;
    private registryVersionList = ["v1.3","v1.2"];
    private connectVersionList = ["v1.1", "v1.0"];
    private channelmappingVersionList = ["v1.0"];
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
            }
            if(Topology.instance){
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
        senderActiveData:{},
        channelmapping:{},
        sendersManifestDetail :{}
    };
    private connections:any = {};


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
            // TODO implement Ping Pong for timeouts for each connection
            // TODO, verify no simultaneous connections are made
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

                                if(changes && type == "devices"){
                                    this.loadChannelMaping(postData);
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


                    if (type == "senders" || type == "flows") {
                        setTimeout(()=>{
                            this.getSenderManifestData(type, g);
                        },200);
                        setTimeout(()=>{
                            this.getSenderManifestData(type, g);
                        },5000);
                    }

                    if(type == "senders"){
                        setTimeout(()=>{
                            this.getSenderActive(type, g);
                        },100);
                    }
                });


        

    }

    async loadChannelMaping(postData:any){
        let cmLoaded = false;
        for(let c of postData.controls){
            // TODO: other versions
            if(c.type=="urn:x-nmos:control:cm-ctrl/v1.0"){
                try{
                    let io = await axios.get(c.href + "/io");
                    let map = await axios.get(c.href + "/map/active");

                    for(let k in io.data.outputs){

                        let data = io.data.outputs[k];
                        if(data.source_id == null){
                            data["receivers"] = [];

                            
                            for(let inId of io.data.outputs[k].caps.routable_inputs){
                                try{
                                    if(io.data.inputs[inId].parent.type = "receiver"){
                                        data["receivers"].push(io.data.inputs[inId].parent.id)
                                    }
                                }catch(e){}
                            }
                            
                            if(data.receivers.length > 0){
                                this.nmosState.channelmapping[k] = data;
                            }
                        }
                    }

                
                    cmLoaded = true;
                    

                }catch(e:any){
                    //console.log(e);
                }
            }
        }

        this.syncNmos.setState(this.nmosState);
        this.updateCrosspoint();

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

                    
                    // request all SDP files, from inactive senders too
                    // If inactive, ignore errors.
                    if (manifest_href && senderId) {
                        axios.get(g.post.manifest_href).then(response => {
                            if(response.data.length > 10){
                                // TODO Check for BAD SDP Files, is this already enough, more than 10 chars and more than 0 flows
                                let sdp = sdpTransform.parse(response.data);
                                sdp["_RAWSDP"] = response.data;

                                // Check if reconnect is needed, basically only if SDP file has changed, not for new SDP files without data.
                                if(sdp.media.length > 0 && active){
                                    if(this.nmosState["sendersManifestDetail"][senderId]._RAWSDP != sdp["_RAWSDP"]){
                                        this.reconnectOnChangesFromSdp(senderId);
                                    }
                                }
                                
                                // log debug info when a active sender reports 
                                if(sdp.media.length < 1 && active){
                                    SyncLog.log("warn", "NMOS", "Got BAD SDP File (no media info) for Flow: " + label + " ( ID: " + senderId +" )")
                                }
                                // write new Data to state
                                this.nmosState["sendersManifestDetail"][senderId] = sdp;
                                this.syncNmos.setState(this.nmosState);
                                this.updateCrosspoint();
                            }else{
                                //SDP files with less than 10 characters are always bad
                                if(active){
                                    SyncLog.log("warn", "NMOS", "Got BAD SDP File (file too small) for Flow: " + label + " ( ID: " + senderId +" )")
                                }
                                try{
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
                        this.updateCrosspoint();
                    } catch (e) {}
                    
                }
            }
        }
    }


    async getSenderActive(type:string, g:any){
        if (g.hasOwnProperty("path") && typeof g.path == "string") {
            if (g.hasOwnProperty("post")) {
                // add or update element
                if (typeof g.post == "object") {

                    let active_href:string[] = [];
                    let senderId = "";
                    let sender:any|null = null;
                    let device:any|null = null;


                    try{
                        senderId = g.path;
                        sender = g.post;
                        if(sender && sender.device_id ){
                            device = this.nmosState.devices[sender.device_id];
                        }else{
                            SyncLog.log("warn", "NMOS", "Can not get active configuration of sender, device ID not provided")
                            return;
                        }

                        // Accept BOTH supported IS-05 control versions.
                        // Devices that advertise v1.1 only (e.g. QSC Core)
                        // previously slipped through this filter, which left
                        // their senderActiveData empty — and the Multicast
                        // Lease Manager could never reconcile the address.
                        // Order matters: v1.1 first, so newer devices that
                        // advertise both don't get stuck on the older URL
                        // (which may exist for compatibility but lack fields).
                        // TODO make prefered version configurable in settings
                        let controlTypes = [{type:"urn:x-nmos:control:sr-ctrl/v1.1",version:"v1.1"}, {type:"urn:x-nmos:control:sr-ctrl/v1.0",version:"v1.0"}]
                        for(let ctrlType of controlTypes){
                            device.controls.forEach((c:any)=>{
                                if(c.type === ctrlType.type){
                                    let href = c.href;
                                    if(href[href.length-1] !== "/"){
                                        href += "/";
                                    }
                                    href += "single/senders/"+senderId+"/active/";
                                    active_href.push(href);
                                }
                            });
                            // at least one href was found, next loop will only give different versions
                            if(active_href.length > 0) break;
                        }
                        
                        
                    }catch(e){}

                    if(active_href.length == 0){
                        SyncLog.log("warn", "NMOS", "Can not get active configuration of sender, no controls available.")
                    }

                    for(let href of active_href){
                        try{
                            let response = await axios.get(href);
                            this.nmosState.senderActiveData[senderId] = response.data;
                            return;
                        }catch(e:any){
                            SyncLog.log("warn", "NMOS", "Can not get active configuration of sender:",{error: e.message, href : href});
                        }
                    }

                    this.syncNmos.setState(this.nmosState);
                    this.updateCrosspoint();
                }
            } else {
                if (type == "senders") {
                    // remove element
                    try {
                        delete this.nmosState.senderActiveData[g.path];
                        this.syncNmos.setState(this.nmosState);
                        this.updateCrosspoint();
                    } catch (e) {}
                    
                }
            }
        }
    }

    updateSyncConnectionState() {
        let list:any[] = [];
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

        // Re-arm the periodic refresh as a SINGLE timer. This method is also
        // called directly on connection open/close and on registry switch;
        // without clearing the previous timer first, every such call used to
        // spawn an additional independent 2 s loop, so the number of
        // structuredClone()+setState passes per second grew without bound
        // over the lifetime of the process. Keeping one handle caps it at
        // exactly one refresh every 2 s.
        if(this.connectionStateTimer != null){
            clearTimeout(this.connectionStateTimer);
        }
        this.connectionStateTimer = setTimeout(()=>{
            this.connectionStateTimer = null;
            this.updateSyncConnectionState();
        }, 2000);
    }
    private connectionStateTimer:any = null;


    reconnectOnChangesFromSdp(senderId:string){
        if(CrosspointAbstraction.instance){
            CrosspointAbstraction.instance.reconnectOnChangesFromSdp(senderId);
        }
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
        }catch(e:any){
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
            }catch(e:any){
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

        let disconnect = senderInfo.senderId == "disconnect";
        if(senderInfo.error != ""){
            SyncLog.log("warning", "NMOS Connect", "No valid sender Info: " + senderInfo.error);
            throw new Error(senderInfo.error);
        }

        // IS-05 v1.x: `requested_time` MUST NOT be supplied for
        // `activate_immediate` activations. Sending `null` works on most
        // devices but strict implementations (Merging Anubis) reject the
        // whole PATCH with HTTP 500. So we leave it absent.
        let patch: any = {
            activation: {
                mode: "activate_immediate",
             },
            transport_params: [],
            master_enable: !disconnect,
        };



        if(!disconnect){
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
        }catch(e:any){
            SyncLog.log("warning", "NMOS Connect", "Receiver with ID: "+receiverId+" is not available in NMOS");
            throw new Error("NMOS: Receiver not available. (Offline?)");
        }

        let interfaces:any[] = []; // TODO type for interface!
        receiver.interface_bindings.forEach((name:any)=>{
            node.interfaces.forEach((inter:any)=>{
                if(inter.name == name){
                    interfaces.push({name:name,mac:inter.port_id});
                }
            })
        });

        // TODO, fix mixed up Amber/Blue Legs
        //      Regenerate SDP with exchanged Primary/Secondary parts
        //      Use exchanged Multicast/Source for Patch request

        // Parse the SDP so we can build EXPLICIT transport_params per leg
        // (multicast_ip / destination_port / source_ip). Some receivers
        // (Anubis among them) reject `{interface_ip:"auto"}` when the SDP
        // has fewer media blocks than the receiver has interface_bindings,
        // so we MUST also disable the surplus legs with rtp_enabled:false.
        let sdpLegs: Array<{ multicast_ip:string, destination_port:number, source_ip:string }> = [];
        if(senderInfo.transport == "rtp.mcast" || senderInfo.transport == "rtp"){
            try{
                let parsedSdp:any = sdpTransform.parse(senderInfo.manifestFile || "");
                if(parsedSdp && Array.isArray(parsedSdp.media)){
                    sdpLegs = parsedSdp.media.map((m:any) => {
                        let destIp = "";
                        let srcIp  = "";
                        try{
                            if(m.sourceFilter && m.sourceFilter.destAddress){
                                destIp = "" + m.sourceFilter.destAddress;
                                srcIp  = "" + (m.sourceFilter.srcList || "");
                            }else if(m.connection && m.connection.ip){
                                destIp = ("" + m.connection.ip).split("/")[0];
                            }else if(parsedSdp.connection && parsedSdp.connection.ip){
                                destIp = ("" + parsedSdp.connection.ip).split("/")[0];
                            }
                        }catch(e){}
                        // TODO: default Port of 5004 as fallback seems strange why is this needed, are there valid SDP files with no port?
                        // Check what fields are used for port parsing in sdp-transform library.
                        let port = (typeof m.port === "number" && m.port > 0) ? m.port : 5004;  
                        return { multicast_ip: destIp, destination_port: port, source_ip: srcIp };
                    });
                }
            }catch(e:any){
                SyncLog.log("warning", "NMOS Connect", "Could not parse SDP for transport_params: " + (e?.message || e));
            }
        }

        let receiverLegCount = receiver.interface_bindings.length;
        for(let i = 0; i < receiverLegCount; i++){
            if(senderInfo.senderId == "disconnect"){
                patch.transport_params.push({ rtp_enabled: false });
                continue;
            }
            if(senderInfo.transport == "rtp.mcast" || senderInfo.transport == "rtp"){
                // The SDP has exactly one transport entry per `m=` block.
                // Receiver legs without a matching media block must be
                // explicitly disabled — leaving them as `{rtp_enabled:true,
                // interface_ip:"auto"}` makes strict receivers reject the
                // whole PATCH because there's no media to bind to.
                if(i < sdpLegs.length && sdpLegs[i].multicast_ip){
                    let leg:any = {
                        multicast_ip:     sdpLegs[i].multicast_ip,
                        destination_port: sdpLegs[i].destination_port,
                        rtp_enabled:      true
                    };
                    if(sdpLegs[i].source_ip){ leg.source_ip = sdpLegs[i].source_ip; }
                    patch.transport_params.push(leg);
                }else{
                    patch.transport_params.push({ rtp_enabled: false });
                }
            }else if(senderInfo.transport == "websocket" || senderInfo.transport == "mqtt"){
                // TODO Websocket / MQTT
                patch.transport_params.push({});
            }else{
                SyncLog.log("warning", "NMOS Connect", "Sender has unsupported transport Information.");
                throw new Error("Transport Type unknown.");
            }
        }

        if(senderInfo.transport == "rtp.mcast" || senderInfo.transport == "rtp"){
            let manifest = senderInfo.manifestFile;

            if(this.settings.fixSdpBugs){
                // UNSPECIFIED is valid in newer NMOS Specifications. Still some devices reject patch when receiving this
                manifest = manifest.replace("colorimetry=UNSPECIFIED;", "colorimetry=BT709;");
                manifest = manifest.replace("TCS=UNSPECIFIED;", "TCS=SDR;");
            }

            patch.transport_file = {
                type: "application/sdp",
                data: manifest,
            };
        }



        let versionFound = false;
        let controlHrefs:any[] = [];
        // TODO, make configurable
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
            }catch(e:any){
                if (axios.isAxiosError(e)) {
                    if(e.code == "ETIMEDOUT"){
                        // NEXT
                        let id = SyncLog.log("info", "nmos_connect", "Patch on "+patchHref+" timed out, trying next.");
                    }else{
                        // TODO....
                        if(e.code == "ERR_BAD_REQUEST"){
                            let id = SyncLog.log("error", "nmos_connect", "Receiver "+receiverId+" returned Error: "+e.code,{controlHrefs,failedControl:patchHref,patch, error:e?.response?.data,});
                            throw new LoggedError("Patch failed: "+e?.response?.data?.error + " / " +e?.response?.data?.debug , id);
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



    async enableFlow(senderId:string, disable=false){

        try{
            let versionFound = false;
            let controlHrefs:any[] = [];

            let sender = this.nmosState.senders[senderId];
            let device = this.nmosState.devices[sender.device_id];

            // TODO make versions configurable
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



            let legCount = 1;
                if(Array.isArray(sender.interface_bindings) && sender.interface_bindings.length > 0){
                sender.interface_bindings.length
            }


            let patch:any = {
                "receiver_id": null,
                "master_enable": !disable,
                "activation": {
                    "mode": "activate_immediate",
                    "requested_time": null,
                },
                transport_params: Array.from(
                    { length: legCount },
                    () => ({
                        rtp_enabled: !disable
                    })
                )
            };



            for(let href of controlHrefs){
                // TODO, version specific things
                let fixSlash = "/"
                if(href.href.endsWith("/")){
                    fixSlash = ""
                }
                let patchHref = href.href + fixSlash + "single/senders/" + senderId + "/staged";
                try{
                    await axios.patch(patchHref, patch, {timeout:15000});
                    SyncLog.log("success", "nmos", "Successfully "+ (disable?"disabled":"enabled") + ": "+senderId, {href:patchHref, data:patch})
                    return;
                }catch(e:any){
                    if (axios.isAxiosError(e)) {
                        if(e.code == "ETIMEDOUT"){
                            // NEXT
                            SyncLog.log("info", "nmos", "Toggle Flow Active: Patch on "+senderId+" timed out, trying next.");
                        }else{
                            // TODO....
                            if(e.code == "ERR_BAD_REQUEST"){
                                SyncLog.log("error", "nmos", "Toggle Flow Active: Sender "+senderId+" returned Error: "+e.code,{controlHrefs,failedControl:patchHref,patch, error:e.response?.data,});
                            }else{
                                SyncLog.log("error", "nmos", "Toggle Flow Active: Sender "+senderId+" returned Error: "+e.code,{controlHrefs,failedControl:patchHref,patch, message:e.message});
                            }
                            return;
                        }
                    }else{
                        return;
                    }
                }
            }
        }catch(e:any){

        }

    }


    /**
     * Toggle a receiver's master_enable flag. Used by the Details page
     * to activate / deactivate a receiver without changing its current
     * sender subscription (sender_id and transport_file stay in place).
     */
    async enableReceiver(receiverId:string, disable=false){
        try{
            let versionFound = false;
            let controlHrefs:any[] = [];

            let receiver = this.nmosState.receivers[receiverId];
            if(!receiver){
                SyncLog.log("warning", "NMOS", "Cannot toggle receiver, unknown id: " + receiverId);
                return;
            }
            let device = this.nmosState.devices[receiver.device_id];

            // TODO make versions configurable
            let controlTypes = [
                {type:"urn:x-nmos:control:sr-ctrl/v1.1", version:"v1.1"},
                {type:"urn:x-nmos:control:sr-ctrl/v1.0", version:"v1.0"}
            ];
            for(let type of controlTypes){
                device.controls.forEach((control:any)=>{
                    if(control.type == type.type){
                        controlHrefs.push({href:control.href, version:type.version});
                        versionFound = true;
                    }
                });
                if(versionFound){ break; }
            }

            let patch:any = {
                master_enable: !disable,
                activation: {
                    mode: "activate_immediate",
                }
            };

            for(let href of controlHrefs){
                let fixSlash = "/"
                if(href.href.endsWith("/")){
                    fixSlash = ""
                }
                let patchHref = href.href + fixSlash + "single/receivers/" + receiverId + "/staged";
                try{
                    await axios.patch(patchHref, patch, {timeout:30000});
                    SyncLog.log("success", "nmos", "Successfully " + (disable?"disabled":"enabled") + " receiver: " + receiverId, {href:patchHref, data:patch});
                    return;
                }catch(e:any){
                    if(axios.isAxiosError(e)){
                        if(e.code == "ETIMEDOUT"){
                            SyncLog.log("info", "nmos", "Toggle Receiver Active: Patch on " + receiverId + " timed out, trying next.");
                        }else{
                            if(e.code == "ERR_BAD_REQUEST"){
                                SyncLog.log("error", "nmos", "Toggle Flow Active: Sender "+receiverId+" returned Error: "+e.code,{controlHrefs,failedControl:patchHref,patch, error:e.response?.data,});
                            }else{
                                SyncLog.log("error", "nmos", "Toggle Flow Active: Sender "+receiverId+" returned Error: "+e.code,{controlHrefs,failedControl:patchHref,patch, message:e.message});
                            }
                            return;
                        }
                    }else{
                        return;
                    }
                }
            }
        }catch(e){}
    }


    async setFlowMulticast(senderId:string, data:any){

        try{
            let versionFound = false;
            let controlHrefs:any[] = []; // TODO get the right control HREF is used multiple times and can be merged into a general function

            let sender = this.nmosState.senders[senderId];
            let device = this.nmosState.devices[sender.device_id];

            // TODO, make versions configurable
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

            // Determine number of legs the sender actually advertises.
            let legCount = 1;

            try{
                if(Array.isArray(sender.interface_bindings) && sender.interface_bindings.length > 0){
                    legCount = sender.interface_bindings.length;
                }
                // When present, the cached senderActive Data is used
                let activeData = this.nmosState.senderActiveData[senderId];
                if(activeData && Array.isArray(activeData.transport_params) && activeData.transport_params.length > 0){
                    legCount = activeData.transport_params.length;
                }
            }catch(e){}

            // Also stretch the array if the requested index demands it
            if(Array.isArray(data.legs)){
                data.legs.forEach((l:any)=>{
                    if(typeof l.index === "number" && l.index + 1 > legCount){
                        legCount = l.index + 1;
                    }
                });
            }

            let transportParams:any[] = [];
            for(let i=0;i<legCount;i++){
                transportParams.push({});
            }

            // Preserve the sender's current master_enable across the PATCH.
            // Per IS-05 a missing field means "leave unchanged", but some
            // firmwares (notably Merging Anubis) misread the omission and
            // deactivate the sender when only transport_params change. By
            // echoing back whatever subscription.active is right now we
            // make the behaviour deterministic across vendors.

            // Fallback, If current master enabled can not be determined, omit value.

            let patch:any = {
                "receiver_id": null,
                "activation": {
                    "mode": "activate_immediate",
                    "requested_time": null,
                },
                "transport_params": transportParams
            };

            try{
                let s:any = this.nmosState.senders[senderId];
                if(s && s.subscription){
                    patch["master_enable"] =  s.subscription.active;
                }

                
                // Also consult the cached IS-05 active snapshot — its
                // master_enable is authoritative when present.
                let active:any = this.nmosState.senderActiveData[senderId];
                if(active && typeof active.master_enable === "boolean"){
                    patch["master_enable"] = active.master_enable;
                }
            }catch(e){}

            

            let meaningfulChange = false;
            data.legs.forEach((l)=>{

                let leg:any = {source_ip:"auto"};
                if(l.multicast !== undefined && l.multicast !== null && l.multicast !== ""){
                    leg.destination_ip = l.multicast;
                    meaningfulChange = true;
                }
                if(l.port !== undefined && l.port !== null && l.port !== ""){
                    let p = parseInt(""+l.port);
                    if(!isNaN(p) && p > 0 && p < 65536){
                        leg.destination_port = p;
                        meaningfulChange = true;
                    }
                }
                patch.transport_params[l.index] = leg;
            });

            // Last-line-of-defence: never send a PATCH that would only set
            // `source_ip: "auto"` on every leg. Such a no-op PATCH causes the
            // reconcile loop to fire forever because nothing on the device
            // changes.
            if(!meaningfulChange){
                SyncLog.log("warn", "nmos", "Refusing to send empty setFlowMulticast PATCH for " + senderId + " (no destination_ip / destination_port).");
                return;
            }

            

            for(let href of controlHrefs){
                // TODO, version specific things
                let fixSlash = ""
                if(href.href[href.href.length-1] == "/"){
                    fixSlash = ""
                }else{
                    fixSlash = "/"
                }
                let patchHref = href.href + fixSlash + "single/senders/" + senderId + "/staged";
                try{
                    await axios.patch(patchHref, patch, {timeout:30000});
                    SyncLog.log("success", "nmos", "Successfully set multicast: "+senderId, {href:patchHref, data:patch});


                    setTimeout(()=>{
                        this.getSenderActive("senders", {path:senderId, post:sender});
                        this.getSenderManifestData("senders", {path:senderId, post:sender});
                    },1000);

                    // TODO optional: force follow of receivers on changed multicasts

                    return;
                }catch(e:any){
                    if (axios.isAxiosError(e)) {
                        if(e.code == "ETIMEDOUT"){
                            // NEXT
                            SyncLog.log("info", "nmos", "Patch on "+senderId+" timed out, trying next.");
                        }else{
                            // TODO....
                            if(e.code == "ERR_BAD_REQUEST"){
                                SyncLog.log("error", "nmos", "Sender "+senderId+" returned Error: "+e.code,{controlHrefs,failedControl:patchHref,patch, error:e?.response?.data,});
                            }else{
                                SyncLog.log("error", "nmos", "Sender "+senderId+" returned Error: "+e.code,{controlHrefs,failedControl:patchHref,patch, message:e.message});
                            }
                            return;
                        }
                    }else{
                        return;
                    }
                }
            }
        }catch(e:any){

        }

    }


    private getOne(hrefList: string[]) {
        return new Promise((resolve, reject) => {
            let promises:Promise<any>[] = [];
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



