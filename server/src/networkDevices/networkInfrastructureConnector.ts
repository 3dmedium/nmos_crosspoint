import { NetworkAuth, NetworkInfrastructure } from "./networkDevice";

export class NetworkInfrastructureConnector {
    changed:any = null;
    constructor(auth:NetworkAuth, changedCallback:any ){
        this.changed = changedCallback;
    }
    update(device:NetworkInfrastructure){
        if(this.changed){
            this.changed(device);
        }
    }
}