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




export default class MediaDevImagineSnp {
    public static instance: MediaDevImagineSnp | null;

    public syncList: SyncObject;
    public quickState:Subject<any>

    
    quickStateInternal = {
        label:"Imagine SNP",
        name:"",
        count:0,
        error:0,
        detail: [
           
        ],
        note:"Hooks Only"
    }
    private state:any = {
        devices:{},
        quickState:this.quickStateInternal,
    }

    
    
    constructor(settings:any){
        this.quickState = new BehaviorSubject<any>(this.quickStateInternal);
        // TODO Config of https ignore SSL cert error
        
        if(MediaDevImagineSnp.instance == null){
            MediaDevImagineSnp.instance = this;
        }

        this.state["quickState"] = this.quickStateInternal;


        this.syncList = new SyncObject("mediadevimaginesnp");
        this.syncList.setState(this.state);
        let server = WebsocketSyncServer.getInstance();
        server.addSyncObject("mediadevimaginesnp","global",this.syncList);


        NmosRegistryConnector.registerModifier("receivers", (id,data)=>{
            try{
                data.label = data.label.replace("SNP-2121160083", "SNP")
            }catch(e){}
            return data;
        })
        NmosRegistryConnector.registerModifier("senders", (id,data)=>{
            // TODO, find serial and then replace
            try{
                data.label = data.label.replace("SNP-2121160083", "SNP")
            }catch(e){}
            return data;
        });

    }

}



