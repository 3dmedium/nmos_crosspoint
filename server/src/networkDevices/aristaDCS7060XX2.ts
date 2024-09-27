import { NetworkAuth, NetworkInfrastructure } from "./networkDevice";
import { NetworkInfrastructureConnector } from "./networkInfrastructureConnector";
export class NIC_MOD extends NetworkInfrastructureConnector {

    
    device:NetworkInfrastructure = {
        id:"",
        name:"Arista DCS 7060 SX2",
        interfaces : [],
        rendering : {mode:"aristadcs"},
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

        let n = 0;

        for(let i = 1; i<49;i++){
            this.device.interfaces.push({
                attached:null,
                id:"E"+i,
                mac:"",
                name:"Eth "+ i,
                num:n++,
                speed:10000,
                maxspeed:25000,
                type:"sfp"
            })
        }
        
        for(let i = 49; i<51;i++){
            for(let j = 1; j<5; j++){
                this.device.interfaces.push({
                    attached:null,
                    id:"E"+i+"/"+j,
                    mac:"",
                    name:"Eth "+ i + "/"+j,
                    num:n++,
                    speed:100000,
                    maxspeed:100000,
                    type:"qsfp-split"
                })
            }
        }

        for(let i = 51; i<55;i++){
            this.device.interfaces.push({
                attached:null,
                id:"E"+i,
                mac:"",
                name:"Eth "+ i,
                num:n++,
                speed:100000,
                maxspeed:100000,
                type:"qsfp"
            })
        }
        
        this.sendUpdates()
    }


    sendUpdates(){
        super.update(this.device);
    }

}