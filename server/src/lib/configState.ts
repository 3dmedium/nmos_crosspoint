import { SyncObject } from "./SyncServer/syncObject";
import { SyncLog } from "./syncLog";

 export class ConfigState {
    public syncCrosspoint: SyncObject;
    crosspointState: CrosspointState = {sources:[], destinations:[]};

    constructor(){
        if(ConfigState.instance == null){
            ConfigState.instance = this;
        }
        
    }

    alias = {};

    public static instance: ConfigState | null;
}




interface CrosspointFlow {
    id:string,
    virtual:boolean,
    number:number,
    name:string,
    niceName:string,
    sourceId:string,
    type:"video" | "audio" | "anc" | "mqtt" | "websocket" | "audiochannel",
    format: string,
    capabilities:string,
    channelNumber: number,
    sourceNumber: number,
};

interface CrosspointDevice {
    id:string,
    virtual:boolean,
    number:number,
    name:string,
    niceName:string,
    flows: CrosspointFlow[]
  }
export interface CrosspointState {
    sources: CrosspointDevice[],
    destinations: CrosspointDevice[]
}
