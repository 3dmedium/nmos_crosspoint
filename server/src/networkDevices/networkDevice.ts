import { NetworkInfrastructureConnector } from "./networkInfrastructureConnector";

export class NetworkInfrastructureAbstrraction {
    settings:NetworkAuth;
    device:NetworkInfrastructure;

    updateCallback:any = null;

    connector:NetworkInfrastructureConnector | null = null;

    constructor( opt:NetworkAuth, callback:any){
        this.settings = opt;
        this.updateCallback = callback;
        try{
            let loaded = require("./"+this.settings.type);
            this.connector = new loaded.NIC_MOD(opt, (dev)=>{this.changed(dev)});
            this.connector.changed = (dev)=>{this.changed(dev)  ;};
        }catch(e){
            // TODO Logging
            //console.log(e)
        }
        
    }

    changed(dev:NetworkInfrastructure){
        this.device = dev;
        if(this.updateCallback){
            this.updateCallback();
        }
    }
}





export interface NetworkAuth {
    name:string,
   type:string,
   connect:string,
   auth:string,
};

export interface NetworkInfrastructure {
    type:"switch"|"router",
    name:string,
    source:"config"|"detected",
    id:string,
    interfaces:NetworkInterface[],
    rendering:any,
}

export interface NetworkDevice {
    type:"camera"|"converter"|"generic",
    name:string,
    source:"nmos",
    id:string,
    interfaces:NetworkInterface[],
    signals:NetworkDeviceSignal[],
    rendering:any,
};

interface NetworkDeviceSignal {
    name:string
}

export interface NetworkInterface {
    name:string,
    id:string,
    num:number,
    speed:number,
    mac:string,
    type:"rj45"|"sfp"|"qsfp"|"qsfp-split",
    maxspeed:number,
    attached:{device:NetworkDevice,port:NetworkInterface},
}