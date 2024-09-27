const mdnsApi = require("multicast-dns");

export class MdnsService {

    mdns:any = null;

    constructor(settings:any){
        MdnsService.instance = this;

        let ip = "0.0.0.0";
        if(settings.hasOwnProperty("mdns") && settings.hasOwnProperty("listen")){
            ip = settings.mdns.listen;
        }
        this.mdns = mdnsApi({
            interface: ip
        });

        this.mdns.on("response", (response) => {
                this.hooks.forEach((hook)=>{
                    hook(response);
                })
        })
    }
    hooks:any[] = [];


    static registerHook(callback){
        MdnsService.instance.hooks.push(callback);
    }

    static query(request){
        MdnsService.instance.mdns.query(request);
    }

    static instance:MdnsService
}