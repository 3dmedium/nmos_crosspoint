import { SyncObject } from "../lib/SyncServer/syncObject";
import { SyncLog } from "../lib/syncLog";

import { NmosRegistryConnector } from "../lib/nmosConnector";
import axios, { isAxiosError } from "axios";
import { writeFileSync } from "fs";

import { applyPatch, createPatch } from "rfc6902";
import { WebsocketClient } from "../lib/SyncServer/websocketClient";
import { WebsocketSyncServer } from "../lib/SyncServer/websocketSyncServer";
import { BehaviorSubject, Subject } from "rxjs";
import { MdnsService } from "../lib/mdnsService";

import { setTimeout as sleep } from 'node:timers/promises'


const fs = require("fs");
const FormData = require('form-data');
const https = require("https");

interface MatroxConvertIpInterface {
    name:string;
    up:boolean;
    ip:string;
    speed:string;
}



class MatroxCipDevice {
    sn:string = "";
    name:string = ""
    
    ipList:string[] = [];
    firmwareMode:string="";
    firmwareVersion:string="";

    type:string = "";
    hasEdid:boolean = false;

    safeMode:boolean = false
    goldenMode:boolean = false

    temperature:string = ""

    direction = ""

    simpleMode = "";

    edidMonitor = ""
    edidNativeResMonitor = ""
    edidInput = ""
    edidNativeResInput = ""



    moinitorMode:"edidpreference"|"stream"|"force"|"" = "";
    monitorResolution:string = "";

    signalPresent = false
    signalResolution = "";

    inputResolution:string = "";
    inputPresent = false;
    inputCompression:"JPEG-XS"|"RAW" = "RAW";
    inputBitrate = 0;
    inputAudio = ""
    inputAudioPresent
    inputNoSignal = ""
    inputSync = ""

    outputMode:"input"|"force"|"" = ""
    outputResolution:string = "";
    outputPresent = false;
    outputBitrate = 0
    outputCompression:"Colibri"|"JPEG-XS"|"RAW" = "RAW";


    masterEnabled = false
    
    linkStatus:MatroxConvertIpInterface[] = [];
    

    frontpanelLock:boolean= false;
    hdcpEnabled:boolean = true;
    jpegxsLicensed:boolean = false;
    ptpStatus:string = "";
    ptpEnabled:boolean = true;
    ptpDomain:string|number = "";

    flowMode:string = "mixed";

    time:number = 0
    
    loading:boolean = false
    outdated:boolean = false

    failed:boolean = false
    error:string = ""
    sessionConflict = false
    unreachable = false



    
}


export default class MediaDevMatroxConvertIp {

    private simultanLoading = 0;

    public static instance: MediaDevMatroxConvertIp | null;

    public syncList: SyncObject;

    public quickState:Subject<any>


    private lastNodeState:any = {};

    
    private authState ={};

    config = {
        "user":"admin",
        "password":"password",
        "closeExistingSessions":true,
        "ignoreHttps":true,
        "edids":[{
            "name":"1080p50",
            "file":"./config/edid/1080p50.bin"
        },{
            "name":"2160p50",
            "file":"./config/edid/2160p50.bin"
        }],
        resolutions:[],
        "manualDevices":[]
    }

    httpsAgent:any = null
    ptpDomain = 127;
    quickStateInternal = {
        label:"Matrox Convert IP",
        name:"matroxcip",
        count:0,
        error:0,
        detail: [
            {label:"Connected", color: "success", count:0 },
            {label:"Session Conflict", color: "warning", count:0 },
            {label:"Unreachable", color: "error", count:0 },
        ],
        note:""
    }
    private state:any = {
        devices:{},
        quickState:this.quickStateInternal,
        settings:{
            edids:[],
            resolutions:[]
        },
        ptpDomain:this.ptpDomain
        
    }

    
    
    constructor(settings:any){
        this.ptpDomain = settings.ptp.domain;
        this.quickState = new BehaviorSubject<any>(this.quickStateInternal);
        // TODO Config of https ignore SSL cert error
        this.httpsAgent = new https.Agent({  
            rejectUnauthorized: !this.config.ignoreHttps,
            keepAlive: true
        });


        try{
            if (!fs.existsSync("./state/mediadev_matroxcip")) {
                fs.mkdirSync("./state/mediadev_matroxcip");
                console.log("Folder created: ./state/mediadev_matroxcip");
            }
        }catch(e){
            console.error("Error while creating Folder: ./state/mediadev_matroxcip");
        }



        try {
            let rawFile = fs.readFileSync("./config/mediadev_matroxcip/matroxcip.json");
            let top = JSON.parse(rawFile);
            this.config = top;
        } catch (e) {
            console.error("Error reading from file: ./config/mediadev_matroxcip/matroxcip.json");
        }


        


        try {
            let rawFile = fs.readFileSync("./state/mediadev_matroxcip/matroxcipstate.json");
            let top = JSON.parse(rawFile);
            this.state = top;
        } catch (e) {
            console.warn("Error reading from file: ./state/mediadev_matroxcip/matroxcipstate.json");
            console.warn("File will be created on first use.");
        }

        try {
            let rawFile = fs.readFileSync("./state/mediadev_matroxcip/matroxcipstateauth.json");
            let top = JSON.parse(rawFile);
            this.authState = top;
        } catch (e) {
            console.warn("Error reading from file: ./state/mediadev_matroxcip/matroxcipstateauth.json");
            console.warn("File will be created on first use.");
        }

        this.state.settings.edids = this.config.edids;
        this.state.settings.resolutions = this.config.resolutions;
        this.state.ptpDomain = this.ptpDomain;


        if(MediaDevMatroxConvertIp.instance == null){
            MediaDevMatroxConvertIp.instance = this;
        }

        for(let device of Object.values(this.state.devices)){
            let dev = (device as any)
            dev.loading = false
            
            dev.loaded = false;
            dev.failed = true
            dev.error = "Device not refreshed"
            dev.sessionConflict = false
            dev.unreachable = 0;

            // Config Upgrades
            dev.linkStatus = [];

        }

        // Config Upgrades
        if(this.state.hasOwnProperty("auth")){
            delete this.state.auth
        }

        this.quickStateInternal.note = "Initial Loading..."
        this.state["quickState"] = this.quickStateInternal;



        



        

        this.config.manualDevices.forEach((dev)=>{
            if(dev.hasOwnProperty('ipList') && dev.hasOwnProperty('sn')){
                if(!this.state.devices.hasOwnProperty(dev.sn)){
                    let cip:MatroxCipDevice = new MatroxCipDevice();
                    cip.sn = dev.sn;
                    cip.ipList = dev.ipList;
                    this.state.devices[dev.sn] = cip;
                    SyncLog.log("info", "matroxcip", "Adding Manual Device:"+ dev.sn)
                }
            }
        })

        this.syncList = new SyncObject("mediadevmatroxcip");
        this.syncList.setState(this.state);
        let server = WebsocketSyncServer.getInstance();
        server.addSyncObject("mediadevmatroxcip","global",this.syncList);

        this.updateQuickState();

        server.addRoute("GET", "matroxcip_forcereload","global", (client: WebsocketClient, query:string[]) => {
            return new Promise((resolve, reject) => {
                let sn = query[0];
                if(sn){
                    this.forceReloadData(sn);
                    resolve({});
                }else{
                    reject({status:403, message:"Missing SN"});
                }
                
            });
        });

        server.addRoute("GET", "matroxcip_forcereloadall","global", (client: WebsocketClient, query:string[]) => {
            return new Promise((resolve, reject) => {
                this.reloadAll(true);
            });
        });

        server.addRoute("POST", "matroxcip_fixptpdomain","global", (client: WebsocketClient, query:string[], postData: any) => {
            return new Promise((resolve, reject) => {
                this.fixPtpDomain(postData.sn).then(()=>{
                    resolve({});    
                }).catch((e)=>{
                    reject({status:400, message:e.message});
                })
                
            });
        });

        server.addRoute("POST", "matroxcip_batchjob","global", (client: WebsocketClient, query:string[], postData: any) => {
            return new Promise((resolve, reject) => {
                let reboot = false;
                if(postData.hasOwnProperty('reboot')){
                    if(postData.reboot === true){
                        reboot = true;
                    }
                }
                this.batchJob(postData.sn,postData.context, reboot).then(()=>{
                    resolve({});    
                }).catch((e)=>{
                    reject({status:400, message:e.message});
                })
                
            });
        });

        server.addRoute("POST", "matroxcip_changeedid","global", (client: WebsocketClient, query:string[], postData: any) => {
            return new Promise((resolve, reject) => {
                this.changeEdid(postData.sn,postData.name).then(()=>{
                    resolve({});    
                }).catch((e)=>{
                    reject({status:400, message:e.message});
                })
                
            });
        });
        
        server.addRoute("POST", "matroxcip_enablemaster","global", (client: WebsocketClient, query:string[], postData: any) => {
            return new Promise((resolve, reject) => {
                this.masterEnable(postData.sn).then(()=>{
                    resolve({});    
                }).catch((e)=>{
                    reject({status:400, message:e.message});
                })
            });
        });
        server.addRoute("POST", "matroxcip_changeresolution","global", (client: WebsocketClient, query:string[], postData: any) => {
            return new Promise((resolve, reject) => {
                this.changeResolution(postData.sn,postData.name).then(()=>{
                    resolve({});
                    
                }).catch((e)=>{
                    reject({status:400, message:e.message});
                })
            });
        });

        server.addRoute("POST", "matroxcip_deletedevice","global", (client: WebsocketClient, query:string[], postData: any) => {
            return new Promise((resolve, reject) => {
                this.deleteDevice(postData.sn).then(()=>{
                    resolve({});    
                }).catch((e)=>{
                    reject({status:400, message:e.message});
                })
            });
        });

        

        NmosRegistryConnector.registerHook("nodes", (id,data)=>{this.nodeChange(id,data)})
        NmosRegistryConnector.registerHook("flows", (id,data)=>{this.flowChange(id,data)})

        NmosRegistryConnector.registerModifier("receivers", (id,data)=>{
            try{
                let idpart = id.split("-");
                if(idpart[idpart.length-1] == "000000000000"){
                    // Fix changing Group Hints in Matrox
                    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = data.tags["urn:x-nmos:tag:grouphint/v1.0"][0].replace(" 0:Video", ":Video");
                    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = data.tags["urn:x-nmos:tag:grouphint/v1.0"][0].replace(" 1:Video", ":Video");
                    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = data.tags["urn:x-nmos:tag:grouphint/v1.0"][0].replace(" 0:Audio", ":Audio");
                    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = data.tags["urn:x-nmos:tag:grouphint/v1.0"][0].replace(" 1:Audio", ":Audio");
                    //if(data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] == "IP IN 0:Video"){
                    //    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = "IP IN:Video";
                    //    SyncLog.log("info", "MatroxCIP", "Modifying: "+data.id)
                    //}
                    //if(data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] == "IP IN 1:Audio"){
                    //    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = "IP IN:Audio";
                    //    SyncLog.log("info", "MatroxCIP", "Modifying: "+data.id)
                    //}
                }
            }catch(e){}
            return data;
        })
        NmosRegistryConnector.registerModifier("senders", (id,data)=>{
            try{
                let idpart = id.split("-");
                if(idpart[idpart.length-1] == "000000000000"){
                    // Fix changing Group Hints in Matrox
                    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = data.tags["urn:x-nmos:tag:grouphint/v1.0"][0].replace(" 0:Video", ":Video");
                    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = data.tags["urn:x-nmos:tag:grouphint/v1.0"][0].replace(" 1:Video", ":Video");
                    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = data.tags["urn:x-nmos:tag:grouphint/v1.0"][0].replace(" 0:Audio", ":Audio");
                    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = data.tags["urn:x-nmos:tag:grouphint/v1.0"][0].replace(" 1:Audio", ":Audio");
                    //if(data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] ==  "IP OUT 0:Video"){
                    //    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = "IP OUT:Video";
                    //    SyncLog.log("info", "MatroxCIP", "Modifying: "+data.id)
                    //}
                    //if(data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] == "IP OUT 1:Audio"){
                    //    data.tags["urn:x-nmos:tag:grouphint/v1.0"][0] = "IP OUT:Audio";
                    //    SyncLog.log("info", "MatroxCIP", "Modifying: "+data.id)
                    //}
                }
            }catch(e){}
            return data;
        });

        

        MdnsService.registerHook((response) => {
            try{
                response.answers.forEach((answer) => {
                    if (answer.name == "_matrox-service-api._tcp.local") {
                        response.additionals.forEach((element) => {
                            if (element.type == "A") {
                                let d = answer.data.split(".");
                                let detail = d[0].split("-");
                                if(detail[0] == "MTXCIP"){
                                    let sn = detail[1].toLowerCase();
                                    if(!this.state.devices.hasOwnProperty(sn)){
                                        let cip = new MatroxCipDevice();
                                        cip.sn = sn;
                                        cip.ipList = [element.data];
                                        this.state.devices[sn]=cip;
                                        setTimeout(()=>{
                                            this.reloadData(cip.ipList, cip.sn, cip);
                                        },1000);
                                        SyncLog.log("info", "matroxcip", "Added Matrox CIP from MDNS: " +sn +", " + cip.ipList[0])
                                    }
                                }
                            } 
                        });
                    }
                });
            }catch(e){
                // TODO SyncLog
                //console.log(e);
            }
        });

        setTimeout(()=>{
            this.mdnsQuery();
        },5000);
        this.mdnsQueryInterval = setInterval(() => {
            this.mdnsQuery();
        }, 60000);


        setTimeout(()=>{
            this.periodicReload();
        },5000)

        setInterval(()=>{
            this.periodicReload();
        },240000)
        
    }

    periodicReloadRunning = false;
    async periodicReload(){
        if(this.periodicReloadRunning){
            return;
        }

        this.periodicReloadRunning = true;
        for(let sn of Object.keys(this.state.devices)){
            let cip = this.state.devices[sn];
            try{
                await this.reloadData(cip.ipList, cip.sn, cip);
            }catch(e){}
            await sleep(2000);
        }

        this.quickStateInternal.note = ""
        this.periodicReloadRunning = false;
    }

    reloadAll(force = false){
        Object.keys(this.state.devices).forEach((sn)=>{
            let cip = this.state.devices[sn];
            this.reloadData(cip.ipList, cip.sn, cip, force);
        })
    }

    mdnsQueryInterval:any = null;

    private mdnsQuery() {
        MdnsService.query({
            questions: [
                {
                    name: "_matrox-service-api._tcp.local",
                    type: "PTR",
                    class: "IN",
                },
            ],
        });
    }


    updateQuickState(){

        let count = 0;
        let error = 0;
        let connected = 0;
        let session = 0;
        let unreachable = 0;

        Object.keys(this.state.devices).forEach((sn)=>{
            count ++;
            if(this.state.devices[sn].sessionConflict){
                session ++;
            }
            if(this.state.devices[sn].unreachable){
                unreachable ++;
            }
            if(this.state.devices[sn].failed){
                error ++;
            }else{
                connected ++;
            }


        })

        this.quickStateInternal.count = count;
        this.quickStateInternal.error = error;
        this.quickStateInternal.detail[0].count = connected; // Connected
        this.quickStateInternal.detail[1].count = session; // Session Conflict
        this.quickStateInternal.detail[2].count = unreachable; // Unreachable

        this.state.quickState = this.quickStateInternal;
        this.syncList.setState(this.state);

        this.quickState.next(this.quickStateInternal)
    }

    saveState(){
        try{writeFileSync("./state/mediadev_matroxcip/matroxcipstate.json", JSON.stringify(this.state))}catch(e){
            console.error("Error writing to file: ./state/mediadev_matroxcip/matroxcipstate.json");
        }
        try{writeFileSync("./state/mediadev_matroxcip/matroxcipstateauth.json", JSON.stringify(this.authState))}catch(e){
            console.error("Error writing to file: ./state/mediadev_matroxcip/matroxcipstateauth.json");
        }
    }

    mdnsAddDevice(data:any){

    }


    nodeChange(id:string, data:any){
        try{
            let idpart = id.split('-');
            if(idpart[idpart.length-1] == "000000000000"){
                let sn = idpart[0];
                if(sn[sn.length-1] == "0"){
                    sn = sn.slice(0,sn.length-1);
                } 

                let ips:string[] = [];
                data.api.endpoints.forEach((ep)=>{
                    ips.push(ep.host);
                });
                let cip:MatroxCipDevice = new MatroxCipDevice();
                cip.sn = sn;
                cip.loading = false;
                if(this.state.devices.hasOwnProperty(sn)){
                    cip = this.state.devices[sn];
                }else{
                    this.state.devices[sn] = cip;
                }

                cip.ipList = ips;
                this.reloadData(ips, sn, cip);
                setTimeout(()=>{
                    this.reloadData(ips, sn, cip);
                },5000);
                

            }
        }catch(e){}
    }


    flowChange(id:string, data:any){
        try{
            let idpart = id.split('-');
                let sn = idpart[0];
                if(sn[sn.length-1] == "0"){
                    sn = sn.slice(0,sn.length-1);
                } 
                if(this.state.devices.hasOwnProperty(sn)){
                    let cip = this.state.devices[sn];

                    this.reloadData(this.state.devices[sn].ipList, sn, cip);
                    setTimeout(()=>{
                        this.reloadData(this.state.devices[sn].ipList, sn, cip);
                    },5000);
                }
            
        }catch(e){}

    }

    // Web Accessible
    forceReloadData(sn:string){
        if(this.state.devices.hasOwnProperty(sn)){
            this.reloadData(this.state.devices[sn].ipList, sn, this.state.devices[sn],true);
        }
    }

    async batchJob(sn:string, source:string, reboot:boolean){
        let ipList:string[] = [];
        let cip;
        if(this.state.devices.hasOwnProperty(sn)){
            ipList = this.state.devices[sn].ipList
            cip = this.state.devices[sn]
        }else{
            throw new Error("Device not found.")
        }
        let sourceData = JSON.parse(source);
        let context = await this.apiRequest(ipList, sn, "GET", "/device/settings/context");

        let data:any = {};

        Object.keys(sourceData).forEach((k)=>{
            try{
            data[k] = context[k];
            Object.keys(sourceData[k]).forEach((kk)=>{
                if(context[k].hasOwnProperty(kk)){
                    context[k][kk] = sourceData[k][kk];
                }
            })
            }catch(e){}
        });
        await this.apiRequest(ipList,sn,"POST","/device/settings/context",data,true);
        if(reboot){
            await sleep(100);
            await this.apiRequest(ipList,sn,"POST","/device/reboot",{"maintenanceMode":false},true);
        }else{
            this.reloadData(ipList,sn,cip);
        }
        
        
    }

    // Web Accessible
    async changeEdid(sn:string, name:string){
        let ipList:string[] = [];
        let cip;
        if(this.state.devices.hasOwnProperty(sn)){
            ipList = this.state.devices[sn].ipList
            cip = this.state.devices[sn]
        }else{
            throw new Error("Device not found.")
        }

        if(name == "__nativeMatrox"){
            await this.apiRequest(ipList,sn,"POST","/device/settings/video/in/mode",{isEdidOverrideEnabled: false, selectEdid: "passthrough",noSignalOption:cip.inputNoSignal})
        }else if(name == "__passthrough"){
            await this.apiRequest(ipList,sn,"POST","/device/settings/video/in/mode",{isEdidOverrideEnabled: true, selectEdid: "passthrough",noSignalOption:cip.inputNoSignal})
        }else{
            for(let edid of this.config.edids){
                if(edid.name == name){
                    await this.apiUploadFile(ipList,sn,"/device/settings/video/in/hdmi/edid/custom/0","edid.bin",edid.file)
                    break;
                }
            }
            await this.apiRequest(ipList,sn,"POST","/device/settings/video/in/mode",{isEdidOverrideEnabled: true, selectEdid: "custom0",noSignalOption:cip.inputNoSignal})
        }
        setTimeout(()=>{
            this.reloadData(ipList,sn,this.state.devices[sn]);    
        },2000)
    }

    async fixPtpDomain(sn:string){
        let ipList:string[] = [];
        let cip;
        if(this.state.devices.hasOwnProperty(sn)){
            ipList = this.state.devices[sn].ipList
            cip = this.state.devices[sn]
        }else{
            throw new Error("Device not found.")
        }

        let context = await this.apiRequest(ipList, sn, "GET", "/device/settings/context");
        if(!context){
            throw new Error("Can not get Context.");
        }
        let data = context.ptpSettings;
        data.domain = this.ptpDomain
        let result = await this.apiRequest(ipList, sn, "POST", "/device/settings/ptp", data);

        setTimeout(()=>{
            this.reloadData(ipList,sn,cip)
        },2000)
    }


    async changeResolution(sn:string, name:string){
        let ipList:string[] = [];
        let cip;
        if(this.state.devices.hasOwnProperty(sn)){
            ipList = this.state.devices[sn].ipList
            cip = this.state.devices[sn]
        }else{
            throw new Error("Device not found.")
        }
        let context = await this.apiRequest(ipList, sn, "GET", "/device/settings/context");
        if(!context){
            throw new Error("Can not get Context.");
        }
        let mode = cip.direction;
        

        if(mode == "tx"){
            if(name == "__input"){
                let data = context.txVideoStream0
                data.selectPixelFormat = "input"
                data.selectResolution = "input"

                await this.apiRequest(ipList, sn, "POST", "/device/settings/context", {txVideoStream0:data});
            }else{
                for(let res of this.config.resolutions){
                    if(res.name == name){
                        
                        let data = context.txVideoStream0
                        data.selectPixelFormat = "force"
                        data.selectResolution = "force"
                        data.colorSpace = "bt709"
                        if(res.sampling){
                            data.pixelFormat = res.sampling
                            }else{
                                data.pixelFormat = "yuv_10_422";
                            }
                            data.resolution = res.settings

                        await this.apiRequest(ipList, sn, "POST", "/device/settings/context", {txVideoStream0:data});
                        break;
                    }
                }
            }
        }else{
            if(name == "__input"){
                let data = context.monitorSettings
                data.selectPixelFormat = "stream"
                data.selectResolution = "stream"
                await this.apiRequest(ipList, sn, "POST", "/device/settings/context", {monitorSettings:data});
            }else if(name == "__edid"){
                let data = context.monitorSettings
                data.selectPixelFormat = "edidpreference"
                data.selectResolution = "edidpreference"
                await this.apiRequest(ipList, sn, "POST", "/device/settings/context", {monitorSettings:data});
            }else{
                for(let res of this.config.resolutions){
                    if(res.name == name){
                        let data = context.monitorSettings
                        data.selectPixelFormat = "force"
                        data.selectResolution = "force"
                        data.isEdidOverrideEnabled =  false;
                        data.colorSpace = "bt709"
                        if(res.sampling){
                            data.pixelFormat = res.sampling

                            }else{
                                data.pixelFormat = "yuv_10_422";
                            }
                        data.resolution = res.settings
                        await this.apiRequest(ipList, sn, "POST", "/device/settings/context", {monitorSettings:data});
                        break;
                    }
                }
            }
        }
        
        setTimeout(()=>{
            this.reloadData(ipList,sn,cip)
        },2000)
    }
    async masterEnable(sn:string){
        let ipList:string[] = [];
        let cip;
        if(this.state.devices.hasOwnProperty(sn)){
            ipList = this.state.devices[sn].ipList
            cip = this.state.devices[sn]
        }else{
            throw new Error("Device not found.")
        }
        let context = await this.apiRequest(ipList, sn, "GET", "/device/settings/context");
        if(!context){
            throw new Error("Can not get Context.");
        }
        let data = context.StreamsEnableSettings;
        data.enable = true;
        await this.apiRequest(ipList, sn, "POST", "/device/settings/streams/master", data);
        
        setTimeout(()=>{
            this.reloadData(ipList,sn,cip)
        },2000)
    }

    async deleteDevice(sn:string){
        try{
            delete this.state.devices[sn];
        }catch(e){
            throw new Error("Can not delete device.");
        }

        try{
            delete this.authState[sn];
        }catch(e){}

        this.syncList.setState(this.state);
        this.updateQuickState();
        this.saveState();

    }




    async reloadData(ipList:string[], sn:string, cip:MatroxCipDevice, force =false){
        if(cip.loading){
            cip.outdated = true;
        }else{
            cip.loading = true;
            this.doReloadData(ipList,sn,cip,force);
        }
    }

    calculateResolution(set:any){
        let res = set.resolution
        let text = ""
        text += res.width;
        text += "x"
        text += res.height;
        if(res.scan == "interlaced"){
            text += "i"
        }else{
            text += "p"
        }
        if(res.refreshRateDen == 1){
            text += res.refreshRateNum;
        }else{
            text += Math.round( (res.refreshRateNum/res.refreshRateDen)*100)/100
        }

        text += " "

        switch(set.pixelFormat){
            case "yuv_10_422":
                text += "YCbCr 10 Bit 4:2:2"
                break;
            case "rgb_10":
                text += "RGB 10 Bit 4:4:4"
                break;
            case "rgb_8":
                text += "RGB 8 Bit 4:4:4"
                break;
            default:
                text += set.pixelFormat
        }

        text += " "

        switch(set.colorSpace){
            case "bt709":
                text += "BT.709"
                break;
            case "bt2020":
                text += "BT.2020"
                break;
            default:
                text += set.colorSpace
        }

        
        // TODO Information is not updated properly on amtrox device, check after firmware updates
        //if(set.hasOwnProperty("colorTcs")){
        //    text += " "
        //    switch(set.colorTcs){
        //        case "sdr":
        //            text += "SDR"
        //            break;
        //        case "pq":
        //            text += "PQ"
        //            break;
        //        case "hlg":
        //            text += "HLG"
        //            break;
        //        default:
        //            text += set.colorTcs
        //    }
        //}else{
        //    //text += " "
        //    //text += "SDR"
        //}



    


        return text;
    }

    calculateAudio(aud:any){
        let text = "";

        text += aud.audioFormat.nbChannels + " Ch ";
        text += (aud.audioFormat.sampleRate/1000) + " kHz ";

        switch(aud.audioFormat.format){
            case "PCM_16":
                text += "16 Bit"
                break;
            case "PCM_24":
                text += "24 Bit"
                break;
            default:
                text += aud.audioFormat.format
        }
        

        // TODO, incomplete Data
        //text += " "
        //text += aud.packetTime + " ms";

        return text;
    }


    async doReloadData(ipList:string[], sn:string, cip:MatroxCipDevice, force = false){
        while(this.simultanLoading > 3){
            await sleep(1000);
        }
        this.simultanLoading ++;
        SyncLog.log("verbose", "matroxcip", "Reloading Matrox CIP with SN: "+sn,{ipList,force});
        cip.loading = true;
        
        this.syncList.setState(this.state);
        let context;
        let status;
        let caps;
        try{
            context = await this.apiRequest(ipList, sn, "GET", "/device/settings/context", {}, force);
            status = await this.apiRequest(ipList, sn, "GET", "/device/status", {}, force);
            cip.unreachable = false;
            if(context == "duplicate" || status == "duplicate"){
                cip.sessionConflict = true;
            }else{
                cip.sessionConflict = false;
            
                if(context && status){
                    try{
                        cip.firmwareVersion = context.header.verSW;
                        switch(context.header.sku){
                            case "fpga2110_hdmi_unc_jpegxs_sfp_10G_rx":
                                cip.firmwareMode = "HDMI JPEG-XS 10G RX"
                                cip.direction = "rx"
                                cip.simpleMode = "IP/JPEG-XS to HDMI"
                                cip.type = "DSH"
                                cip.hasEdid = true;
                            break;
                            case "fpga2110_hdmi_unc_jpegxs_sfp_10G_tx":
                                cip.firmwareMode = "HDMI JPEG-XS 10G TX"
                                cip.direction = "tx"
                                cip.simpleMode = "HDMI to IP/JPEG-XS"
                                cip.type = "DSH"
                                cip.hasEdid = true;
                            break;

                            case "fpga2110_hdmi_unc_sfp_10_25G_tx":
                                cip.firmwareMode = "HDMI 10G/25G TX"
                                cip.direction = "tx"
                                cip.simpleMode = "HDMI to IP"
                                cip.type = "DSH"
                                cip.hasEdid = true;
                            break;

                            case "fpga2110_hdmi_unc_sfp_10_25G_rx":
                                cip.firmwareMode = "HDMI 10/25G RX"
                                cip.direction = "rx"
                                cip.simpleMode = "IP to HDMI"
                                cip.type = "DSH"
                                cip.hasEdid = true;
                            break;

                            case "fpga2110_hdmi_colibri_combo_rj45_1_2G5_rx":
                                cip.firmwareMode = "HDMI Colibri 1/2.5G RX"
                                cip.direction = "rx"
                                cip.simpleMode = "IP/Colibri to HDMI"
                                cip.type = "SRH"
                                cip.hasEdid = true;
                            break;

                            case "fpga2110_hdmi_colibri_combo_rj45_1_2G5_tx":
                                cip.firmwareMode = "HDMI Colibri 1/2.5G TX"
                                cip.direction = "rx"
                                cip.simpleMode = "IP/Colibri to HDMI"
                                cip.type = "SRH"
                                cip.hasEdid = true;
                            break;

                            case "fpga2110_hdmi_jpegxs_combo_rj45_1_2G5_rx":
                                cip.firmwareMode = "HDMI JPEG-XS 1/2.5G RX"
                                cip.direction = "rx"
                                cip.simpleMode = "IP/JPEG-XS to HDMI"
                                cip.type = "SRH"
                                cip.hasEdid = true;
                            break;

                            case "fpga2110_hdmi_jpegxs_combo_rj45_1_2G5_tx":
                                cip.firmwareMode = "HDMI JPEG-XS 1/2.5G TX"
                                cip.direction = "tx"
                                cip.simpleMode = "HDMI to IP/JPEG-XS"
                                cip.type = "SRH"
                                cip.hasEdid = true;
                            break;




                            // SDI / DSS

                            case "fpga2110_sdi_unc_jpegxs_sfp_10G_rx":
                                cip.firmwareMode = "SDI JPEG-XS 10G RX"
                                cip.direction = "rx"
                                cip.simpleMode = "IP/JPEG-XS to SDI"
                                cip.type = "DSS"
                                cip.hasEdid = false;
                            break;
                            case "fpga2110_sdi_unc_jpegxs_sfp_10G_tx":
                                cip.firmwareMode = "SDI JPEG-XS 10G TX"
                                cip.direction = "tx"
                                cip.simpleMode = "SDI to IP/JPEG-XS"
                                cip.type = "DSS"
                                cip.hasEdid = false;
                            break;

                            case "fpga2110_sdi_unc_sfp_10_25G_tx":
                                cip.firmwareMode = "SDI 10G/25G TX"
                                cip.direction = "tx"
                                cip.simpleMode = "SDI to IP"
                                cip.type = "DSS"
                                cip.hasEdid = false;
                            break;

                            case "fpga2110_sdi_unc_sfp_10_25G_rx":
                                cip.firmwareMode = "SDI 10/25G RX"
                                cip.direction = "rx"
                                cip.simpleMode = "IP to SDI"
                                cip.type = "DSS"
                                cip.hasEdid = false;
                            break;



                            default:
                                cip.firmwareMode = "Unknown"
                        }

                        cip.name = context.nmosInterface.deviceName;

                        cip.moinitorMode = context.monitorSettings.selectResolution;
                        if(cip.moinitorMode == "force"){
                            cip.monitorResolution = this.calculateResolution(context.monitorSettings)
                        }else if(cip.moinitorMode == "stream"){
                            cip.monitorResolution = this.calculateResolution(context.rxVideoStreamManual0)
                        }else if(cip.moinitorMode == "edidpreference"){
                            cip.monitorResolution = context.RxMonitorEdidHeader.nativeResolution;
                        }

                        

                        cip.inputCompression = context.rxVideoStreamManual0.isCompressionEnabled ? "JPEG-XS":"RAW";
                        cip.inputAudioPresent = status.audios[0].isPresent;
                        cip.inputAudio = this.calculateAudio(context.rxAudioStreamManual0)
                        cip.inputNoSignal = context.videoInSettings.noSignalOption
                        cip.inputSync = context.videoInSettings.syncType

                        cip.outputMode = context.txVideoStream0.selectPixelFormat
                        
                        cip.outputPresent = true
                        cip.outputCompression = context.txVideoStream0.isCompressionEnabled ? "JPEG-XS":"RAW";



                        cip.masterEnabled = context.StreamsEnableSettings.enable

                        if(context.txAudioStreamManual0.isIPMXEnabled && context.txVideoStreamManual0.isIPMXEnabled){
                            cip.flowMode = "ipmx";
                        }else if(context.txAudioStreamManual0.isIPMXEnabled == false && context.txVideoStreamManual0.isIPMXEnabled == false){
                            cip.flowMode = "st2110";
                        }else{
                            cip.flowMode = "mixed";
                        }

                        if(context.RxMonitorEdidHeader && context.RxMonitorEdidHeader.isHeaderValid){
                            cip.edidMonitor = context.RxMonitorEdidHeader.monitorName
                            cip.edidNativeResMonitor = context.RxMonitorEdidHeader.nativeResolution
                        }else{
                            cip.edidMonitor = "Not connected"
                            cip.edidNativeResMonitor = ""
                            if(!cip.hasEdid){
                                cip.edidMonitor = "-";
                            }
                        }
                        
                        if(context.videoInSettings.isEdidOverrideEnabled){
                            if(context.videoInSettings.selectEdid == "passthrough"){
                                if(context.TxPasstroughEdidHeader.isHeaderValid){
                                    cip.edidInput = context.TxPasstroughEdidHeader.monitorName
                                    cip.edidNativeResInput = context.TxPasstroughEdidHeader.nativeResolution
                                }else{
                                    cip.edidInput = "Not available"
                                    cip.edidNativeResInput = ""
                                }
                            }else{
                                if(context.TxCustomEdidHeader.isHeaderValid){
                                    cip.edidInput = context.TxCustomEdidHeader.monitorName
                                    cip.edidNativeResInput = context.TxCustomEdidHeader.nativeResolution
                                }else{
                                    cip.edidInput = "Not available"
                                    cip.edidNativeResInput = ""
                                }
                            }

                        }else{
                            cip.edidInput = "Native Matrox"
                            cip.edidNativeResInput = ""
                            if(!cip.hasEdid){
                                cip.edidInput = "-";
                            }
                        }



                        cip.frontpanelLock = context.otherSettings.areButtonsLocked;
                        cip.hdcpEnabled = context.hdcpSettings.enableHdcpSupport;

                        cip.ptpDomain = context.ptpSettings.domain;
                        cip.ptpEnabled = context.ptpSettings.isEnabled;


                        
                    }catch(e){
                        SyncLog.log("error","MatroxCIP", "Can not parse Context for:  "+ ipList.join(", "), e);
                        cip.failed = true,
                        cip.error = "Can not parse Context.";
                    }

                
                    
                    try{
                        if(cip.direction == "tx"){
                            cip.inputResolution = this.calculateResolution(status.videos[0]);
                            cip.outputResolution = this.calculateResolution(status.frameBuffer);
                            cip.inputPresent = status.videos[0].isPresent
                            cip.inputBitrate = 0
                        }else{
                            cip.inputResolution = this.calculateResolution(status.frameBuffer);
                            // TODO why is the data so strange in the device...
                            // Expected resolution is not the actual resolution
                            // Videos 0 seems to be exact output pixel format
                            //cip.outputResolution = cip.monitorResolution;
                            cip.outputResolution = this.calculateResolution(status.videos[0]);
                            cip.inputPresent = status.frameBuffer.resolution.isPresent
                            cip.inputBitrate = status.videoStreams[0].bitrateKbits/1000
                        }
                    }catch(e){
                        SyncLog.log("error","MatroxCIP", "Can not parse Status for:  "+ ipList.join(", "), e);
                        cip.failed = true,
                        cip.error = "Can not parse Status.";
                    }

                    cip.ptpStatus = status.ptpState;
                    cip.temperature = status.temperature;

                    
                    cip.monitorResolution = this.calculateResolution(status.videos[0])

                    cip.linkStatus = [];
                    status.networks.forEach((inter,i)=>{
                        let link:MatroxConvertIpInterface = {
                            name:"", up:false, ip:"", speed:""
                        }
                        if(i == 0){
                            link.name = "OOB"
                        }else if(i == 1){
                            link.name = "MEDIA 1"
                        }else if(i == 2){
                            link.name = "MEDIA 2"
                        }else{
                            link.name = "eth "+ i;
                        }

                        if(inter.state == "disconnected"){
                            link.up = false; 
                        }else{
                            link.up = true;
                            link.speed = inter.state
                        }
                        link.ip = inter.ipv4Address;

                        cip.linkStatus.push(link)

                    })
                    
                }else{
                    cip.failed = true,
                    cip.error = "Can not Load from Context and Status.";
                }
            }
            cip.error = "";
        cip.failed = false;
        cip.loading = false;

        }catch(e){
            cip.loading = false;
            cip.failed = true;
            cip.error = e.message;
            if (axios.isAxiosError(e)) {
                if(e.code == "ETIMEDOUT"){
                    e.message = "Timeout"
                }
                cip.unreachable = true;
            }
        }

        if(cip.outdated){
            cip.outdated = false;
            this.reloadData(ipList,sn,cip);
        }else{
            this.syncList.setState(this.state);
        }

        this.updateQuickState();
        this.saveState();
        this.simultanLoading--;
    }


    async apiRequest(ipList:string[], sn:string ,method:"POST"|"GET", href:string, data:any={}, force = false){
        let baseUrl = "";
        let ip = "";

        for(let ipt of ipList){

            baseUrl = "https://"+ipt+":443";
            let url = baseUrl + "/device/caps";
            let result = await axios.get(url, {httpsAgent:this.httpsAgent, timeout:10000});
            ip = ipt;

            let caps = result.data
            this.state.devices[sn].jpegxsLicensed = caps.isJpegxsLicenseInstalled
            this.state.devices[sn].safeMode = caps.isSafeMode
            this.state.devices[sn].goldenMode = caps.isGolden

            break;
        }
        if(baseUrl == ""){
            SyncLog.log("error","MatroxCIP", "No connection possible to: "+ ipList.join(", "));
            return null;
        }
        let duplicate = false

        let doLogin = async (sn:string)=>{

            let user = this.config.user
            let password = this.config.password

            this.config.manualDevices.forEach((d)=>{
                if(d.hasOwnProperty("auth")){
                    if(d.hasOwnProperty("sn")){
                        if(d.sn == sn){        
                            user = d.auth.user;
                            password = d.auth.password;
                        }
                    }else{
                        if(d.hasOwnProperty("ipList")){
                            let matched = false;
                            ipList.forEach((ip1)=>{
                                d.ipList.forEach((ip2)=>{
                                    if(ip1==ip2){
                                        matched = true;
                                    }
                                })
                            })
                            if(matched){
                                user = d.auth.user;
                                password = d.auth.password;
                            }
                            
                        }
                    }
                }
            })

            try{
                let url = baseUrl + "/user/login";
                let result = await axios.post(url, {
                    username:user,
                    password:password,
                    closeExistingSessions:this.config.closeExistingSessions || force
                }, {httpsAgent:this.httpsAgent});
                this.authState[sn] = result.data.access_token;
                
            }catch(e){ 
                if(isAxiosError(e)){
                    if(e.response?.data?.code == 18){
                        // duplicate session
                        SyncLog.log("warning", "MatroxCIP", "Session Conflict while login: " + ip)
                        duplicate = true;
                        throw new Error("Other Session active")
                    }else{
                        SyncLog.log("error","MatroxCIP", "Auth not possible: "+ ipList.join(", "),e.response.data);
                        throw new Error(e.response.data.message);
                    }
                }else{
                    throw new Error(e.message);
                }
            }
        }

        if(!this.authState.hasOwnProperty(sn)){
            try{
                await doLogin(sn);
            }catch(e){
                throw new Error("Auth not possible: "+e.message);
            }
        }

        if(this.authState.hasOwnProperty(sn)){
            let url = baseUrl + href;
            try{    
                let result:any = {};
                if(method == "GET" ){
                    result = await axios.get(url, {
                        headers:{
                            Authorization: "Bearer "+this.authState[sn],
                            Cookie:"session_token="+this.authState[sn]
                        },
                        httpsAgent:this.httpsAgent
                    });
                }else if(method == "POST"){
                    result = await axios.post(url, data, {
                        headers:{
                            Authorization: "Bearer "+this.authState[sn],
                            Cookie:"session_token="+this.authState[sn]
                        },
                        httpsAgent:this.httpsAgent
                    });
                }
                return result.data;
            }catch(e){ 
                if(e.response?.status == 401){
                    // Login expired...
                    try{
                        await doLogin(sn);
                    }catch(e){
                        throw new Error("Auth not possible: "+e.message);
                    }
                    if(this.authState.hasOwnProperty(sn)){
                        try{    
                            let url = baseUrl + href;
                            let result:any = {};
                            if(method == "GET" ){
                                result = await axios.get(url, {
                                    headers:{
                                        Authorization: "Bearer "+this.authState[sn],
                                        Cookie:"session_token="+this.authState[sn]
                                    },
                                    httpsAgent:this.httpsAgent
                                });
                            }else if(method == "POST"){
                                result = await axios.post(url, data, {
                                    headers:{
                                        Authorization: "Bearer "+this.authState[sn],
                                        Cookie:"session_token="+this.authState[sn]
                                    },
                                    httpsAgent:this.httpsAgent
                                });
                            }
                            return result.data;
                        }catch(e){ 
                            throw new Error("Can not get Data: "+e.message);
                        }
                    }else{
                        SyncLog.log("error","MatroxCIP", "Auth not possible: "+ ipList.join(", "));
                        throw new Error("Auth not possible.");
                    }
                }else{
                    SyncLog.log("error","MatroxCIP", "Can not access data on: "+ url,e);
                }
            }
        }else{
            SyncLog.log("error","MatroxCIP", "Auth not possible: "+ ipList.join(", "));
            throw new Error("Auth not possible.")
        }

        if(duplicate){
            throw new Error("Other Session active")
        }else{
            throw new Error("Unknown error")
        }


    }




    async apiUploadFile(ipList:string[], sn:string , href:string, fileName:string, file:string){
        let baseUrl = "";
        let ip = "";

        for(let ipt of ipList){
            try{
                baseUrl = "https://"+ipt+":443";
                let url = baseUrl + "/device/caps";
                let result = await axios.get(url, {httpsAgent:this.httpsAgent});
                ip = ipt;
                break;
            }catch(e){ 
                // TODO Logging
                //console.log(e)
            }
        }
        if(baseUrl == ""){
            SyncLog.log("error","MatroxCIP", "No connection possible to: "+ ipList.join(", "));
            return null;
        }
        

        if(this.authState.hasOwnProperty(sn)){
            try{    
                let url = baseUrl + href;
                let result:any = {};

                var formData = new FormData();
                formData.append("file", fs.createReadStream(file), fileName);
                
                result = await axios.post(url, formData, {
                    headers:{
                        Authorization: "Bearer "+this.authState[sn],
                        Cookie:"session_token="+this.authState[sn],
                        ...formData.getHeaders()
                    },
                    httpsAgent:this.httpsAgent
                });
                //console.log(result)
                
            }catch(e){ 
                // TODO Logging
                //console.log(e)
            }
        }else{
            SyncLog.log("error","MatroxCIP", "Auth not possible: "+ ipList.join(", "));
        }

    }
}



