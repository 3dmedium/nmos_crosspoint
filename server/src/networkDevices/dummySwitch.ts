import { NetworkAuth, NetworkInfrastructure } from "./networkDevice";
import { NetworkInfrastructureConnector } from "./networkInfrastructureConnector";
export class NIC_MOD extends NetworkInfrastructureConnector {

    
    device:NetworkInfrastructure = {
        id:"",
        name:"dummySwitch_X",
        interfaces : [],
        rendering : null,
        source : "config",
        type : "switch"
    };
    updateInterval:number = 2000;

    counter = 0;
    name = "";
    constructor(auth:NetworkAuth, changedCallback:any){
        super(auth,changedCallback);

        this.device.name = auth.name;
        this.name = auth.name;


        for(let i = 0; i<24;i++){
            this.device.interfaces.push({
                attached:null,
                id:""+i,
                mac:"",
                name:"int et "+ i,
                num:i,
                speed:10000,
                maxspeed:100000,
                type:"sfp"
            })
        }
        
        this.sendUpdates()
    }


    sendUpdates(){
        super.update(this.device);
    }

}