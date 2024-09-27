import { SyncObject } from "./SyncServer/syncObject";
import { SyncLog } from "./syncLog";

import { NetworkInfrastructureAbstrraction, NetworkAuth,NetworkDevice,NetworkInfrastructure  } from "../networkDevices/networkDevice";
import { WebsocketSyncServer } from "./SyncServer/websocketSyncServer";



const fs = require("fs");

 export class Topology {
    public static instance: Topology | null;

    public syncTopology: SyncObject;

    nmosState:any;
    networkDevices: NetworkAuth[] = [];
    abstractions:NetworkInfrastructureAbstrraction[] = [];
    topologyState: TopologyState = {devices:[], infrastructure:[]};
    
    constructor(){

        try {
            let rawFile = fs.readFileSync("./config/topology.json");
            let top = JSON.parse(rawFile);
            this.networkDevices = top.networkDevices;
        } catch (e) {
            console.error("Error reading from file: ./config/topology.json");
        }

        if(Topology.instance == null){
            Topology.instance = this;
        }
        this.syncTopology = new SyncObject("topology");

        this.networkDevices.forEach((dev)=>{
            this.createInfrastructure(dev)
        })
        this.updateInfrastructure();

        WebsocketSyncServer.getInstance().addSyncObject("topology","global",this.syncTopology);
    }


    createInfrastructure(dev:NetworkAuth){
        let int = new NetworkInfrastructureAbstrraction(dev, ()=>{this.updateInfrastructure()})
        this.abstractions.push(int);
    }

    updateDevicesFromNmos(state:any){
        this.nmosState = state;

        this.topologyState.devices = [];
        if(this.nmosState && this.nmosState.nodes){
            for(let id in this.nmosState.nodes){
                let node = this.nmosState.nodes[id];
                let dev:NetworkDevice = {
                    id:node.id,
                    interfaces:[],
                    signals:[],
                    name:node.label,
                    rendering:"",
                    source:"nmos",
                    type:"generic"
                }
                node.interfaces.forEach((inter)=>{
                    //let interface:NetworkInterface = {
                        //name:inter.name,
                        //mac:reduceMac(inter.port_id)
                    //}
                })
                this.topologyState.devices.push(dev);
            }
            this.syncTopology.setState(this.topologyState);
        }

    }



    updateInfrastructure(){
        this.topologyState.infrastructure = [];
        this.abstractions.forEach((a)=>{
            this.topologyState.infrastructure.push(a.device)
        })
        this.syncTopology.setState(this.topologyState);
    }


    
}

interface TopologyState {
    devices:NetworkDevice[],
    infrastructure:NetworkInfrastructure[],
 };



