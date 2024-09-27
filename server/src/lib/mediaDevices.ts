import { SyncObject } from "./SyncServer/syncObject";
import { WebsocketSyncServer } from "./SyncServer/websocketSyncServer";
import { SyncLog } from "./syncLog";

const fs = require("fs");

 export class MediaDevices {
    public syncDeviceList: SyncObject;
    deviceList:any = {deviceTypes:[]};
    deviceHandlers:any[] = [];

    constructor(settings:any){
        this.syncDeviceList = new SyncObject("mediadevices", this.deviceList);

        let server = WebsocketSyncServer.getInstance();
        server.addSyncObject("mediadevices","global",this.syncDeviceList);

        let modDisabled:any=[];

        try{
            if(settings.hasOwnProperty("disabledModules") && settings.disabledModules.hasOwnProperty("mediadevices")){
                settings.disabledModules.mediadevices.forEach((m)=>{
                    let name = ""+m;
                    modDisabled.push(name);
                });
            }
        }catch(e){}

        let path = "./dist/mediaDevices/"
        try{
            let folder = fs.readdirSync(path, {withFileTypes: true})
            folder.forEach((f)=>{
                if(!f.isDirectory()){
                    
                    let modName = f.name.split(".")[0];
                    let fext = f.name.split(".")[1];
                    //let modName = f.name.slice(0,f.name.length-3);
                    let fext_last = f.name.slice(f.name.length-2)
                    if(fext == "js" && fext_last == "js"){
                        // Load Extension
                        if(modDisabled.includes(modName)){
                            SyncLog.log("info", "MediaDevices", "Disabled MediaDevice from: "+f.name)
                        }else{
                            try{
                                let mediaDevClass = require("../../"+f.path + f.name).default;
                                this.deviceHandlers.push(new mediaDevClass(settings));
                                SyncLog.log("info", "MediaDevices", "Load MediaDevice from: "+f.name)
                            }catch(e){
                                SyncLog.log("error", "MediaDevices", "Can not load from: "+f.name, e)
                            }
                        }
                    }
                }
            })
        }catch(e){
            SyncLog.log("error", "MediaDevices", "can not read folder: "+path, e)
        }


            this.deviceHandlers.forEach((h,i)=>{
                
                h.quickState.subscribe((v)=>{
                    this.deviceList.deviceTypes[i] = v;
                    this.syncDeviceList.setState(this.deviceList)
                })
            })

        
        this.syncDeviceList.setState(this.deviceList);
    }

}



export class MediaDeviceInterface {

    
}


