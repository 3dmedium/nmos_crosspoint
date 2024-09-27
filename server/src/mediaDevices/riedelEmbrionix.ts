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

interface EMX_License {
    name:string,
    licensed:boolean
}

interface EMX_Device {
    id:string,
    ip:string[],
    name:string,
    type:string,
    mode:string,
    activeFirmware:string,
    license:EMX_License[],

    error:boolean,

    loading:boolean,
    reloadRequested:boolean
};

export default class MediaDevRiedelEmbrionix {
    public static instance: MediaDevRiedelEmbrionix | null;

    public syncList: SyncObject;
    public quickState:Subject<any>

    
    quickStateInternal = {
        label:"Riedel Embrionix Plattform",
        name:"riedelembrionix",
        count:0,
        error:0,
        detail: [
            
        ],
        note:"FusioN, MuoN, VirtU"
    }
    private state:any = {
        devices:{},
        quickState:this.quickStateInternal,
    }

    
    
    constructor(settings:any){
        this.quickState = new BehaviorSubject<any>(this.quickStateInternal);
        
        if(MediaDevRiedelEmbrionix.instance == null){
            MediaDevRiedelEmbrionix.instance = this;
        }

        this.state["quickState"] = this.quickStateInternal;


        this.syncList = new SyncObject("mediadevriedelembrionix");
        this.syncList.setState(this.state);
        let server = WebsocketSyncServer.getInstance();
        server.addSyncObject("mediadevriedelembrionix","global",this.syncList);

        NmosRegistryConnector.registerModifier("nodes", (id,data)=>{
            try{
                // TODO config with filter and autodetect
                if(data.description == "st2110 node"){
                    this.updateDevice(data);
                }
            }catch(e){}
            return data;
        });

        setInterval(()=>{
            this.periodicReload();
        },120000);
    }

    periodicReloadRunning = false;
    async periodicReload(){
        if(this.periodicReloadRunning){
            return;
        }

        this.periodicReloadRunning = true;
        for(let id of Object.keys(this.state.devices)){
            //let emx = this.state.devices[id];
            try{
                await this.reloadDevice(id);
            }catch(e){}
            await sleep(1000);
        }

        this.quickStateInternal.note = ""
        this.periodicReloadRunning = false;
    }

    createrNewEMXDevice(id:string){
        let emx:EMX_Device = {
            id:id,
            ip:[],
            name:"",
            type:"",
            mode:"",
            activeFirmware:"",
            license:[],

            error:false,

            loading:false,
            reloadRequested:false
        }
        return emx;
    }


    updateDevice(nmosData:any){
        let ip = []
        nmosData.api.endpoints.forEach((e)=>{
            ip.push(e.host);
        })
        if(this.state.devices.hasOwnProperty(nmosData.id)){
            if(JSON.stringify(ip) == JSON.stringify(this.state.devices[nmosData.id].ip)){
                this.state.devices[nmosData.id].name = nmosData.hostname;
                //Do nothing...
                return;
            }else{
                this.state.devices[nmosData.id].ip = ip;
                this.state.devices[nmosData.id].name = nmosData.hostname;
                //update data...
                setTimeout(()=>{
                    this.reloadDevice(nmosData.id);
                },10)
                return;
            }

        }
        
        this.state.devices[nmosData.id] = this.createrNewEMXDevice(nmosData.id);
        this.state.devices[nmosData.id].ip = ip;
        this.state.devices[nmosData.id].name = nmosData.hostname;
        setTimeout(()=>{
            this.reloadDevice(nmosData.id);
        },10)
        

    }

    async reloadDevice(id:string){
        if(this.state.devices[id].loading == true){
            this.state.devices[id].reloadRequested = true;
            return;
        }
        this.state.devices[id].loading = true;
        this.syncList.setState(this.state);

        let self = await this.apiRequest(this.state.devices[id].ip, "GET", "/self/information" );
        if(self){
            try{
                let emx = this.state.devices[id];
                emx.type = self.base_type;
                emx.mode = self.type;
                emx.activeFirmware = "";

                emx.error = false;

                this.state.devices[id] = emx;
            }catch(e){
                this.state.devices[id] = true;
                SyncLog.error("Embrionix", "failed to load data on: " + JSON.stringify(this.state.devices[id].ip) +" Message: "+ e.message)
            }
        }
        
        let firmware = await this.apiRequest(this.state.devices[id].ip, "GET", "/self/firmware" );
        if(firmware){
            
            try{
                let emx = this.state.devices[id];
                firmware.info.forEach((f)=>{
                    if(f.active){
                        emx.firmware = f.desc + " Ver: " + f.version
                    }
                })
                this.state.devices[id] = emx;

            }catch(e){
                SyncLog.error("Embrionix", "failed to load firmware on: " + JSON.stringify(this.state.devices[id].ip) +" Message: "+ e.message)
            }
        }


        let license = await this.apiRequest(this.state.devices[id].ip, "GET", "/self/license" );
        if(license){
            try{
                let emx = this.state.devices[id];
                emx.license = [];
                Object.keys(license.feature).forEach((k)=>{
                    emx.license.push({
                        name:k,
                        licensed: (license.feature[k] == "licensed" ? true: false)
                    })
                })
                this.state.devices[id] = emx;

            }catch(e){
                SyncLog.error("Embrionix", "failed to load license on: " + JSON.stringify(this.state.devices[id].ip) +" Message: "+ e.message)
            }

        }

        this.state.devices[id].loading = false;
        this.updateCount();
        this.syncList.setState(this.state);
        if(this.state.devices[id].reloadRequested){
            setTimeout(()=>{
                this.reloadDevice(id);
            },0);
        }
    }

    updateCount(){
        this.quickStateInternal.count = 0;
        this.quickStateInternal.error = 0;

        Object.values(this.state.devices).forEach((emx:EMX_Device)=>{
            this.quickStateInternal.count ++;
            if(emx.error){
                this.quickStateInternal.error ++;
            }
        });
        this.state.quickState = this.quickStateInternal;
        this.quickState.next(this.quickStateInternal);
    }





    async apiRequest(ipList:string[],method:"POST"|"GET", href:string, data = null){
        let baseUrl = "";
        let ip = "";

        for(let ipt of ipList){
            baseUrl = "http://"+ipt+":80/emsfp/node/v1";
            try{
                let result = await axios.get(baseUrl, {timeout:30000});
                ip = ipt;
                break;
            }catch(e){}
        }
        if(baseUrl == ""){
            SyncLog.log("error","Embrionix", "No connection possible to: "+ ipList.join(", "));
            return null;
        }

        let url = baseUrl + href;
        try{    
            let result:any = {};
            if(method == "GET" ){
                result = await axios.get(url, {});
            }else if(method == "POST"){
                result = await axios.post(url, data, { });
            }
            return result.data;
        }catch(e){ 
            SyncLog.log("error","Embrionix", "Can not access data on: "+ url + " Message: "+ e.message);        
        }
    }



}



