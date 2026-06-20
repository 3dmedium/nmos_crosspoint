import { CrosspointDevice, CrosspointFlow, CrosspointShadowState, CrosspointState, CrosspointShadowDevice } from "./crosspointAbstraction";
import { ComplexCompare, ShortenNames } from "./functions";

import { BitrateCalculator } from "./bitrateHelper/BitrateCalculator"
import { parseSettings } from "./parseSettings";

const crypto = require('crypto');
const md5 = data => crypto.createHash('md5').update(data).digest("hex")


const fs = require("fs");
const {  parentPort } = require('worker_threads');




class CrosspointUpdateThread{

    crosspointState: CrosspointState = {devices:[]};
    crosspointShadow: CrosspointShadowState = {devices:{}};
    nmosState : any = null;
    crosspointAlias = {};
    crosspointHidden = {};
    nextDeviceNum :number = 1;

    informMulticast = true;
    storedMulticast:any={};

    
    // TODO Config
    nmosUseGroupHints = true;

    settings:any = null;

    constructor(){

       
        try {
            let rawFile = fs.readFileSync("./config/settings.json");
            let tempSettings = JSON.parse(rawFile);
            this.settings = parseSettings(tempSettings);
        } catch (e) {
            //SyncLog.log("error", "Settings", "Error while reading file: ./config/settings.json", e);
        }


        parentPort.on('message', (message) => {
            let data = JSON.parse(message);
            this.update(data);
        });


        try{
            if (!fs.existsSync("./state")) {
                fs.mkdirSync("./state");
                parentPort.postMessage(JSON.stringify({
                    log:{severity:"info", topic:"Crosspoint Settings", text:"Created folder: ./state", raw:null}
                }));
                console.log("Created folder: ./state");
            }
        }catch(e:any){
            parentPort.postMessage(JSON.stringify({
                log:{severity:"critical", topic:"Crosspoint Settings", text:"Can not create folder: ./state ..." + e, raw:null}
            }));
        }

        try {
            let rawFile = fs.readFileSync("./state/crosspoint.json");
            this.crosspointShadow = JSON.parse(rawFile);
        } catch (e) {
            parentPort.postMessage(JSON.stringify({
                log:{severity:"warning", topic:"Crosspoint Settings", text:"Error while reading file: ./state/crosspoint.json", raw:null}
            }));
            parentPort.postMessage(JSON.stringify({
                log:{severity:"warning", topic:"Crosspoint Settings", text:"File will be created on first use.", raw:null}
            }));
        }

        try {
            let rawFile = fs.readFileSync("./state/alias.json");
            this.crosspointAlias = JSON.parse(rawFile);
        } catch (e) {
            parentPort.postMessage(JSON.stringify({
                log:{severity:"warning", topic:"Crosspoint Settings", text:"Error while reading file: ./state/alias.json", raw:null}
            }));
            parentPort.postMessage(JSON.stringify({
                log:{severity:"warning", topic:"Crosspoint Settings", text:"File will be created on first use.", raw:null}
            }));
        }

        try {
            let rawFile = fs.readFileSync("./state/hidden.json");
            this.crosspointHidden = JSON.parse(rawFile);
        } catch (e) {
            parentPort.postMessage(JSON.stringify({
                log:{severity:"warning", topic:"Crosspoint Settings", text:"Error while reading file: ./state/hidden.json", raw:null}
            }));
            parentPort.postMessage(JSON.stringify({
                log:{severity:"warning", topic:"Crosspoint Settings", text:"File will be created on first use.", raw:null}
            }));
        }


        try {
            let rawFile = fs.readFileSync("./state/multicast.json");
            this.storedMulticast = JSON.parse(rawFile);
        } catch (e) {
            parentPort.postMessage(JSON.stringify({
                log:{severity:"warning", topic:"Crosspoint Settings", text:"Error while reading file: ./state/multicast.json", raw:null}
            }));
            parentPort.postMessage(JSON.stringify({
                log:{severity:"warning", topic:"Crosspoint Settings", text:"File will be created on first use.", raw:null}
            }));
        }

        this.nextDeviceNum = this.settings.firstDynamicNumber;

        for (let d of Object.values(this.crosspointShadow.devices)) {
            if(d.num >= this.nextDeviceNum){
                this.nextDeviceNum = d.num+1;
            }
        }

        if(this.settings.autoMulticast){
            parentPort.postMessage(JSON.stringify({
                log:{severity:"info", topic:"Multicast Config", text:"Starting automatic Multicast configuration.", raw:null}
            }));
            setInterval(()=>{
                // Todo, when disabled, the service should run but not do any changes
                this.updateMulticast();
            },30000);
        }
    }


    updateRequest = 0;
    updateTimeout:any = null;
    update(data:any){



        if(data.hasOwnProperty('crosspointChanges')){
            this.changeCrosspoint(data.crosspointChanges);
        }

   

        if(data.hasOwnProperty('nmosState')){
            this.nmosState = data.nmosState;
            this.updateRequest ++;
        }

        if(data.hasOwnProperty('changeAlias')){

            if(data.changeAlias.alias != ""){
                this.crosspointAlias[data.changeAlias.id] = data.changeAlias.alias;
            }else{
                if(this.crosspointAlias.hasOwnProperty(data.changeAlias.id)){
                    delete this.crosspointAlias[data.changeAlias.id];
                }
            }

            try{
                fs.writeFileSync("./state/alias.json", JSON.stringify(this.crosspointAlias));
            }catch(e:any){
                console.error("Error writing to file: ./state/alias.json");
            }

            this.updateRequest ++;
        }

        if(data.hasOwnProperty('toggleHidden')){
            let hidden = false;
            if(this.crosspointHidden.hasOwnProperty(data.toggleHidden.id)){
                delete this.crosspointHidden[data.toggleHidden.id];
            }else{
                this.crosspointHidden[data.toggleHidden.id] = true;
                hidden = true;
            }

            for(let dev of this.crosspointState.devices){
                if(dev.id ==  data.toggleHidden.id){
                    dev.hidden =hidden
                }
                for(let type of Object.keys(dev.senders)){
                    for( let flow of dev.senders[type]){
                        if(flow.id == data.toggleHidden.id){
                            flow.hidden = hidden;
                        }
                    }
                }
                for(let type of Object.keys(dev.receivers)){
                    for( let flow of dev.receivers[type]){
                        if(flow.id == data.toggleHidden.id){
                            flow.hidden = hidden;
                        }
                    }
                }
            }

            parentPort.postMessage(JSON.stringify({
                crosspointState: this.crosspointState
            }));

            try{
                fs.writeFileSync("./state/hidden.json", JSON.stringify(this.crosspointHidden));
            }catch(e:any){
                console.error("Error writing to file: ./state/hidden.json");
            }

            return;
        }


        if(this.updateRequest > 0){
            if(this.updateTimeout && this.updateRequest < 10){
                clearTimeout(this.updateTimeout);
                setTimeout(()=>{
                    this.doUpdate();
                },10)
            }else{
                setTimeout(()=>{
                    this.doUpdate();
                },10)
            }
        }
        

        
    }


    changeCrosspoint(change:any){
        let changed = false;
        let aliasChanged = false;

        console.log(change)

        if(change.action == "delete"){
            if(change.flowId == ""){

                try{

                    for(let type of Object.keys(this.crosspointShadow.devices[change.devId].senders)){
                        for(let sender of Object.keys(this.crosspointShadow.devices[change.devId].senders[type])){
                            try{
                                delete this.crosspointAlias[sender];
                                aliasChanged = true;
                            }catch(e){ console.log(e)}
                        }
                    }

                    for(let type of Object.keys(this.crosspointShadow.devices[change.devId].receivers)){
                        for(let sender of Object.keys(this.crosspointShadow.devices[change.devId].receivers[type])){
                            try{
                                delete this.crosspointAlias[sender];
                                aliasChanged = true;
                            }catch(e){ console.log(e)}
                        }
                    }

                }catch(e){console.log(e)}

                try{
                    delete this.crosspointShadow.devices[change.devId];
                    changed = true;
                }catch(e){ console.log(e)}

                try{
                    delete this.crosspointAlias[change.devId];
                    aliasChanged = true;
                }catch(e){ console.log(e)}

                

            }else{
                try{
                    let dev = this.crosspointShadow.devices[change.devId];
                    for(let type of Object.keys(dev.senders)){
                        try{
                            delete dev.senders[type][change.flowId]
                            changed = true;
                        }catch(e){ console.log(e)}

                        try{
                            delete this.crosspointAlias[change.flowId];
                            aliasChanged = true;
                        }catch(e){ console.log(e)}
                    }

                    for(let type of Object.keys(dev.receivers)){
                        try{
                            delete dev.receivers[type][change.flowId]
                            changed = true;
                        }catch(e){ console.log(e)}

                        try{
                            delete this.crosspointAlias[change.flowId];
                            aliasChanged = true;
                        }catch(e){ console.log(e)}
                    }


                }catch(e){ console.log(e)}
            }
        }

        if(change.action == "edit"){
            
        }

        if(change.action == "create"){
            
        }

        if(change.action == "movedevice"){
            let newNum = Number.parseInt(""+change.newNum);
            let oldNum = this.crosspointShadow.devices[change.devId].num;

            if(oldNum != newNum){
                if(newNum == -1){
                    this.crosspointShadow.devices[change.devId].num = -1;
                    changed = true;
                }
                if(newNum > 0){

                    for(let dev of Object.keys(this.crosspointShadow.devices)){
                        if(this.crosspointShadow.devices[dev].num == newNum){
                            this.crosspointShadow.devices[dev].num = oldNum;
                            changed = true;
                        }
                    }

                    this.crosspointShadow.devices[change.devId].num = newNum;
                    changed = true;
                }

            }
        }

        if(change.action == "moveflow"){
            let newNum = Number.parseInt(""+change.newNum);
            let type = change.type;
            let flowId = change.flowId;
            let oldNum = -1;
            let found = false;
            let dev:CrosspointShadowDevice = this.crosspointShadow.devices[change.devId];

            let direction :"senders"|"receivers" = "senders";
            
            try{
                oldNum = dev.senders[type][flowId].num;
                direction = "senders"
                found = true;
            }catch(e){ }
            try{
                oldNum = dev.receivers[type][flowId].num;
                direction = "receivers"
                found = true;
            }catch(e){ }

            if(found){
                console.log(dev[direction][type][flowId])
                if(newNum == -1){
                    dev[direction][type][flowId].num = -1;
                    changed = true;
                }
                if(newNum > 0){
                    for(let id of Object.keys(dev[direction][type])){
                        if(dev[direction][type][id].num == newNum){
                            dev[direction][type][id].num = oldNum;
                            changed = true;
                        }
                    }

                    dev[direction][type][flowId].num = newNum;
                    changed = true;
                }
            }
        }
            
        

        




        if(changed){
            this.doUpdate();
            parentPort.postMessage(JSON.stringify({
                log:{severity:"info", topic:"Crosspoint", text:"Shadow State was modified.", raw:null}
            }));
            try{
                fs.writeFileSync("./state/crosspoint.json", JSON.stringify(this.crosspointShadow));
            }catch(e:any){
                console.error("Error writing to file: ./state/crosspoint.json");
            }
        }
    }

    doUpdate(){
        // TODO Statistic for performance
        //let start = Date.now();

        this.updateShadow();
        this.updateState();
        this.updateRequest = 0;
        parentPort.postMessage(JSON.stringify({
            crosspointState: this.crosspointState
        }));

        //let timeTaken = Date.now() - start;
        //console.log("- - - - - - - - Crosspoint Update -- Total time taken : " + timeTaken + " milliseconds");
        
    }

    updateShadow(){
        let changed = false;

        for(let devId in this.crosspointShadow.devices){
            if(devId.startsWith("nmosgrp_")){

                this.crosspointShadow.devices[devId].available = false;
            }
        }
        if(this.nmosState){
            // NMOS Senders

            // alphabetical sorting....
            let list:any[] = [];
            for (let s of Object.values(this.nmosState.senders)) {
                list.push(s)
            };
            
            list = list.sort((a,b)=>{
                return ComplexCompare(a.label,b.label);
            })
            for (let s of list) {
                try {
                    let send:any = s;

                    let groupId = "";
                    let groupHint = false;
                    let groupLabel = "";

                    if(this.nmosUseGroupHints && send.hasOwnProperty('tags') && send.tags.hasOwnProperty("urn:x-nmos:tag:grouphint/v1.0") && Array.isArray(send.tags["urn:x-nmos:tag:grouphint/v1.0"]) && send.tags["urn:x-nmos:tag:grouphint/v1.0"].length > 0){
                        
                        // TODO verify behaviour on devices, does the object mean something?
                        let tagVal = send.tags["urn:x-nmos:tag:grouphint/v1.0"][0];
                        // Some devices send objects instead of strings here; coerce
                        // defensively so .split() doesn't throw and kill the whole
                        // sender → device re-creation pass.
                        let group = ("" + (tagVal ?? "")).split(':')[0];
                        groupId = 'nmosgrp_' +md5(group+send.device_id);
                        groupHint = true;
                        if(this.nmosState.devices.hasOwnProperty(send.device_id)){

                            // If device is new, check naming
                            let groupLabels:string[] = [];
                            this.nmosState.devices[send.device_id].senders.forEach((id:string)=>{
                                if(this.nmosState.senders[id]){
                                    let otherSender = this.nmosState.senders[id]
                                    if(otherSender.hasOwnProperty('tags') && otherSender.tags.hasOwnProperty("urn:x-nmos:tag:grouphint/v1.0") && Array.isArray(otherSender.tags["urn:x-nmos:tag:grouphint/v1.0"]) && otherSender.tags["urn:x-nmos:tag:grouphint/v1.0"].length > 0  ) {
                                        let otherTagVal = otherSender.tags["urn:x-nmos:tag:grouphint/v1.0"][0];
                                        let otherGroup = ("" + (otherTagVal ?? "")).split(':')[0];
                                        if(!groupLabels.includes(otherGroup)){
                                            groupLabels.push(otherGroup);
                                        }
                                    }
                                }
                            })
                            
                            if(groupLabels.length > 1){
                                groupLabel = this.nmosState.devices[send.device_id].label + " - " + group;
                            }else{
                                groupLabel = this.nmosState.devices[send.device_id].label;
                            }

                        }else{
                            groupLabel = group;
                        }
                    }else{
                        groupId = "nmos_"+send.device_id;
                        if(this.nmosState.devices.hasOwnProperty(send.device_id)){
                            groupLabel = this.nmosState.devices[send.device_id].label;
                        }else{
                            groupLabel = "UNKNOWN";
                        }
                    }




                    if(!this.crosspointShadow.devices.hasOwnProperty(groupId)){
                        this.crosspointShadow.devices[groupId] = {
                            available:false,
                            id:groupId,
                            num: this.nextDeviceNum++,
                            order:-1,
                            name:groupLabel,
                            senders:{ audio:{},audiochannel:{},video:{},data:{},websocket:{},mqtt:{}, unknown:{} },
                            receivers:{ audio:{},audiochannel:{},video:{},data:{},websocket:{},mqtt:{}, unknown:{} }
                        }
                        changed = true;
                    }else{
                        if(this.crosspointShadow.devices[groupId].name != groupLabel){
                            this.crosspointShadow.devices[groupId].name = groupLabel
                            changed = true;
                        }
                    }
                    this.crosspointShadow.devices[groupId].available = true;

                    let type = this.getNmosSenderClass(send.id);

                    if(!this.crosspointShadow.devices[groupId].senders[type].hasOwnProperty("nmos_"+send.id)){
                        //create
                        let num = 1;
                        //console.log(type + " " + Object.values(this.crosspointShadow.devices[groupId].senders[type]))
                        Object.values(this.crosspointShadow.devices[groupId].senders[type]).forEach((shs:any)=>{
                            if(shs.num >= num){
                                num = shs.num+1;
                            }
                        });

                        this.crosspointShadow.devices[groupId].senders[type]["nmos_"+send.id] = {
                            id:"nmos_"+send.id,
                            name:send.label,
                            num:num,
                            order:-1,
                            type:type,
                            channelNumber:-1
                        }
                        changed = true;

                        if(type=="audio"){
                            // TODO Audio Mapping
                            // Get All channels
                            // Get Channel names

                            
                        }

                    }else{
                        //update
                        if(this.crosspointShadow.devices[groupId].senders[type]["nmos_"+send.id].name != send.label){
                            this.crosspointShadow.devices[groupId].senders[type]["nmos_"+send.id].name = send.label;
                            changed = true;
                        }

                    }
                } catch (sendErr:any) {
                    // Defensive: one malformed sender (e.g. weird grouphint
                    // tag shape) must NOT prevent the loop from creating /
                    // updating shadow entries for the rest. Without this
                    // guard a single bad sender takes down the entire
                    // device row in the UI — and after a Forget the device
                    // never gets re-added because re-add happens right here.
                    try {
                        parentPort.postMessage(JSON.stringify({
                            log:{ severity:"warn", topic:"Crosspoint",
                                  text:"updateShadow: skipped sender due to error: " + (sendErr?.message || sendErr),
                                  raw:{ senderId: (s as any)?.id || "?", label: (s as any)?.label || "" } }
                        }));
                    } catch(e) {}
                }
            }

            // NMOS Receivers
            list = [];
            for (let s of Object.values(this.nmosState.receivers)) {
                list.push(s)
            };
            
            list = list.sort((a,b)=>{
                return ComplexCompare(a.label,b.label);
            })




            for (let r of list) {
                try {
                    let recv:any = r;

                    let groupId = "";
                    let groupHint = false;
                    let groupLabel = "";

                    if(this.nmosUseGroupHints && recv.hasOwnProperty('tags') && recv.tags.hasOwnProperty("urn:x-nmos:tag:grouphint/v1.0") && Array.isArray(recv.tags["urn:x-nmos:tag:grouphint/v1.0"]) && recv.tags["urn:x-nmos:tag:grouphint/v1.0"].length > 0){
                        let tagVal = recv.tags["urn:x-nmos:tag:grouphint/v1.0"][0];
                        let group = ("" + (tagVal ?? "")).split(':')[0];
                        let flowNameFromGroup = ("" + (tagVal ?? "")).split(':')[1];
                        groupId = 'nmosgrp_' +md5(group+recv.device_id);
                        groupHint = true;
                        if(this.nmosState.devices.hasOwnProperty(recv.device_id)){




                            // If device is new, check naming
                            let groupLabels:string[] = [];
                            this.nmosState.devices[recv.device_id].receivers.forEach((id:string)=>{
                                if(this.nmosState.receivers[id]){
                                    let otherReceiver = this.nmosState.receivers[id]
                                    if(otherReceiver.hasOwnProperty('tags') && otherReceiver.tags.hasOwnProperty("urn:x-nmos:tag:grouphint/v1.0") && Array.isArray(otherReceiver.tags["urn:x-nmos:tag:grouphint/v1.0"]) && otherReceiver.tags["urn:x-nmos:tag:grouphint/v1.0"].length > 0  ) {
                                        let otherTagVal = otherReceiver.tags["urn:x-nmos:tag:grouphint/v1.0"][0];
                                        let otherGroup = ("" + (otherTagVal ?? "")).split(':')[0];
                                        if(!groupLabels.includes(otherGroup)){
                                            groupLabels.push(otherGroup);
                                        }
                                    }
                                }
                            })
                            
                            if(groupLabels.length > 1){
                                groupLabel = this.nmosState.devices[recv.device_id].label + " - " + group;
                            }else{
                                groupLabel = this.nmosState.devices[recv.device_id].label;
                            }

                        }else{
                            groupLabel = group;
                        }
                    }else{
                        groupId = "nmos_"+recv.device_id;
                        if(this.nmosState.devices.hasOwnProperty(recv.device_id)){
                            groupLabel = this.nmosState.devices[recv.device_id].label ;
                        }else{
                            groupLabel = "Unknown";
                        }
                    }

                    


                    if(!this.crosspointShadow.devices.hasOwnProperty(groupId)){
                        this.crosspointShadow.devices[groupId] = {
                            available:false,
                            id:groupId,
                            num: this.nextDeviceNum++,
                            order:-1,
                            name:groupLabel,
                            senders:{ audio:{},audiochannel:{},video:{},data:{},websocket:{},mqtt:{}, unknown:{} },
                            receivers:{ audio:{},audiochannel:{},video:{},data:{},websocket:{},mqtt:{}, unknown:{} }
                        }
                        changed = true;
                    }else{
                        if(this.crosspointShadow.devices[groupId].name != groupLabel){
                            this.crosspointShadow.devices[groupId].name = groupLabel
                            changed = true;
                        }
                    }


                    this.crosspointShadow.devices[groupId].available = true;

                    let type = this.getNmosReceiverClass(recv.id);

                    if(!this.crosspointShadow.devices[groupId].receivers[type].hasOwnProperty("nmos_"+recv.id)){
                        //create
                        let num = 1;
                        //console.log(type + " " + Object.values(this.crosspointShadow.devices[groupId].senders[type]))
                        Object.values(this.crosspointShadow.devices[groupId].receivers[type]).forEach((shs:any)=>{
                            if(shs.num >= num){
                                num = shs.num+1;
                            }
                        });

                        this.crosspointShadow.devices[groupId].receivers[type]["nmos_"+recv.id] = {
                            id:"nmos_"+recv.id,
                            name:recv.label,
                            num:num,
                            order:-1,
                            type:type,
                            channelNumber:-1
                        }
                        changed = true;

                    }else{
                        //update
                        if(this.crosspointShadow.devices[groupId].receivers[type]["nmos_"+recv.id].name != recv.label){
                            this.crosspointShadow.devices[groupId].receivers[type]["nmos_"+recv.id].name = recv.label;
                            changed = true;
                        }

                    }
                } catch (recvErr:any) {
                    try {
                        parentPort.postMessage(JSON.stringify({
                            log:{ severity:"warn", topic:"Crosspoint",
                                  text:"updateShadow: skipped receiver due to error: " + (recvErr?.message || recvErr),
                                  raw:{ receiverId: (r as any)?.id || "?", label: (r as any)?.label || "" } }
                        }));
                    } catch(e) {}
                }
            }
        }

        // ----- Prune ghost devices -----
        // TODO: this is a temporary fix for devices without sender/receiver.
        // Make sure they show up in UI and can be removed manually.
        
        try {
            for(let devId of Object.keys(this.crosspointShadow.devices)){
                let d:any = this.crosspointShadow.devices[devId];
                if(!d) continue;

                let hasSenders = false;
                for(let t of Object.keys(d.senders || {})){
                    if(Object.keys(d.senders[t] || {}).length > 0){ hasSenders = true; break; }
                }
                let hasReceivers = false;
                if(!hasSenders){
                    for(let t of Object.keys(d.receivers || {})){
                        if(Object.keys(d.receivers[t] || {}).length > 0){ hasReceivers = true; break; }
                    }
                }

                if(!hasSenders && !hasReceivers){
                    parentPort.postMessage(JSON.stringify({
                        log:{ severity:"info", topic:"Crosspoint",
                              text:"Auto-pruned ghost device with no flows: " + devId,
                              raw:{ name: d.name || "" } }
                    }));
                    delete this.crosspointShadow.devices[devId];
                    // Alias should outlive this deletion (Device comes back later with more sneders/receivers)
                    //try{ delete this.crosspointAlias[devId]; }catch(e){}
                    changed = true;
                }
            }
        } catch(e) {}


        this.informMulticast = true;
        if(changed){
            parentPort.postMessage(JSON.stringify({
                log:{severity:"info", topic:"Crosspoint", text:"Shadow State was modified.", raw:null}
            }));
            try{
                fs.writeFileSync("./state/crosspoint.json", JSON.stringify(this.crosspointShadow));
            }catch(e:any){
                console.error("Error writing to file: ./state/crosspoint.json");
            }
        }
    }

    updateState(){

        this.crosspointState = {
            devices:[]
        }
        // devices
        for (let dev of Object.values(this.crosspointShadow.devices)) {
            try {
                let device: CrosspointDevice = {
                    id:dev.id,
                    num:dev.num,
                    dynamic:true,
                    alias:"",
                    ip:"",
                    senderIds:[],
                    receiverIds:[],
                    connectedFlows:[],
                    hidden:(this.crosspointHidden.hasOwnProperty(dev.id)),
                    name:dev.name,
                    order:dev.order,
                    available:false,
                    senders:{ audio:[],audiochannel:[],video:[],data:[],websocket:[],mqtt:[], unknown:[] },
                    receivers:{ audio:[],audiochannel:[],video:[],data:[],websocket:[],mqtt:[],  unknown:[] },
                    clockLocked:false, // TODO read from data
                    clockSourceId:"" // TODO read from data
                }
                if(dev.id.startsWith("nmosgrp_")){
                    device.available = dev.available;
                }
                if(dev.id.startsWith("nmos_")){
                    if(this.nmosState){
                        if(this.nmosState.devices.hasOwnProperty(dev.id.substring(5))){
                                device.available = true;
                        }
                    }
                }
                if(this.crosspointAlias.hasOwnProperty(dev.id)){
                    device.alias = this.crosspointAlias[dev.id];
                }else{
                    device.alias = device.name;
                }

                //senders
                for(let senderType of Object.values(dev.senders)){
                    for(let send of Object.values(senderType)){
                        if(send.type != "unknown"){
                            let source:CrosspointFlow = {
                                id:send.id,
                                name: send.name,
                                order: send.order,
                                num:send.num,
                                dynamic:true,
                                type:send.type,
                                alias:send.name,
                                connectedFlowId:"",
                                connectedFlowLabel:"", // TODO implement
                                connectedFlowFormat:"", // TODO implement
                                hidden:(this.crosspointHidden.hasOwnProperty(send.id)),
                                available:false,
                                active:false,
                                sourceNumber:-1,
                                channelNumber:-1,
                                manifestOk:false,
                                capabilities:{mediaTypes:[],transport:"", dash7:false},
                                capLimits:"",
                                format:"",
                                bitrate:{v:0, hint:"unknown"},
                                legs:[] // TODO implement
                            }
                            device.senderIds.push(send.id);
                            if(this.crosspointAlias.hasOwnProperty(send.id)){
                                source.alias = this.crosspointAlias[send.id];
                            }
                            if(send.id.startsWith("nmos_")){
                                if(this.nmosState){ // TODO more error Handling ???
                                    let nmosId = send.id.substring(5)
                                    if(this.nmosState.sendersManifestDetail.hasOwnProperty(nmosId)){
                                        source.manifestOk = true;
                                    }
                                    if(
                                        this.nmosState.senders.hasOwnProperty(nmosId) &&
                                        this.nmosState.flows.hasOwnProperty(this.nmosState.senders[nmosId].flow_id) &&
                                        this.nmosState.sources.hasOwnProperty(this.nmosState.flows[this.nmosState.senders[nmosId].flow_id].source_id)
                                    ){
                                        source.available = true;
                                        source.format = this.getNmosSenderForamt(nmosId);
                                        source.bitrate = this.getNmosSenderBitrate(nmosId);
                                        if(this.nmosState.senders[nmosId].interface_bindings?.length > 1){
                                            source.capabilities.dash7 = true;
                                        }
                                        if(
                                            this.nmosState.senders[nmosId].transport == "urn:x-nmos:transport:rtp" ||
                                            this.nmosState.senders[nmosId].transport == "urn:x-nmos:transport:rtp.mcast"
                                        ){
                                            source.capabilities.transport = "rtp";
                                        }
                                        source.capabilities.mediaTypes.push(this.nmosState.flows[this.nmosState.senders[nmosId].flow_id].media_type);
                                        // Subscription may not yet be populated for a freshly-
                                        // registered sender — guard with optional chaining so an
                                        // exception here doesn't kill the entire device row.
                                        source.active = !!this.nmosState.senders[nmosId].subscription?.active;
                                    }
                                }
                            }
                            device.senders[send.type].push(source);
                        }
                    }
                }


                //receivers
                for(let receiverType of Object.values(dev.receivers)){
                    for(let recv of Object.values(receiverType)){
                        if(recv.type != "unknown"){
                            let receiver:CrosspointFlow = {
                                id:recv.id,
                                name: recv.name,
                                order: recv.order,
                                num:recv.num,
                                dynamic:true,
                                type:recv.type,
                                alias:recv.name,
                                connectedFlowId:"",
                                connectedFlowLabel:"", // TODO Implement
                                connectedFlowFormat:"", // TODO implement
                                hidden:(this.crosspointHidden.hasOwnProperty(recv.id)),
                                available:false,
                                active:false,
                                sourceNumber:-1,
                                channelNumber:-1,
                                manifestOk:false,
                                capabilities:{mediaTypes:[],transport:"", dash7:false},
                                capLimits:"cpa Limits",
                                format:"",
                                bitrate:{v:0, hint:"unknown"},
                                legs:[] // TODO implement
                            }
                            device.receiverIds.push(recv.id);
                            if(this.crosspointAlias.hasOwnProperty(recv.id)){
                                receiver.alias = this.crosspointAlias[recv.id];
                            }
                            if(recv.id.startsWith("nmos_")){
                                if(this.nmosState){ // TODO more error Handling ???
                                    let nmosId = recv.id.substring(5)
                                    if(
                                        this.nmosState.receivers.hasOwnProperty(nmosId)
                                        
                                    ){
                                        receiver.available = true;
                                        if(
                                            this.nmosState.receivers[nmosId].transport == "urn:x-nmos:transport:rtp" ||
                                            this.nmosState.receivers[nmosId].transport == "urn:x-nmos:transport:rtp.mcast"
                                        ){
                                            receiver.capabilities.transport = "rtp";
                                        }
                                        // Same defensive treatment as the sender side — a brand-
                                        // new IS-04 receiver may lack `subscription` or `caps`
                                        // until the registry pushes the full record.
                                        receiver.active = !!this.nmosState.receivers[nmosId].subscription?.active;
                                        receiver.capabilities.mediaTypes = this.nmosState.receivers[nmosId].caps?.media_types || [];
                                        
                                        let sub:any = this.nmosState.receivers[nmosId].subscription;
                                        if(sub && sub.active && sub.sender_id){
                                            let flowRef = "nmos_" + sub.sender_id;
                                            receiver.connectedFlowId = flowRef;
                                            device.connectedFlows.push(flowRef);
                                        }
                                    }
                                }
                            }
                            device.receivers[recv.type].push(receiver);
                        }

                    }
                }




                this.crosspointState.devices.push(device);
            } catch (devErr:any) {
                // TODO per flow defense !
                // Per-device defense in depth: a single malformed flow
                // (e.g. a freshly-added IS-04 sender that arrives before its
                // subscription/flow/source records are filled in) must NOT
                // make the rest of the device tree disappear from the UI.
                // Log and move on; the device gets another chance on the
                // next worker tick once the registry data has settled.
                try {
                    parentPort.postMessage(JSON.stringify({
                        log:{ severity:"warn", topic:"Crosspoint",
                              text:"updateState: skipped device due to error: " + (devErr?.message || devErr),
                              raw:{ devId: (dev && (dev as any).id) || "?" } }
                    }));
                } catch(e) {}
            }
        }

        // Post process available
        for (let dev of Object.values(this.crosspointState.devices)){
            let flowCount = 0;
            
            for(let type of Object.keys(dev.senders)){
                dev.senders[type].forEach((f)=>{
                    if(f.available){
                        flowCount++;
                    }
                })
            }
            for(let type of Object.keys(dev.receivers)){
                dev.receivers[type].forEach((f)=>{
                    if(f.available){
                        flowCount++;
                    }
                })
            }

            if(flowCount == 0){
                dev.available = false;
            }else{
                dev.available = true;
            }
        }

    }


    getNmosSenderBitrate(senderId:string){
        let bitrate = 0;
        let bitrateHint = "unknown";
        try {
            let sender = this.nmosState.senders[senderId];
            let flow = this.nmosState.flows[sender.flow_id];
            let source = this.nmosState.sources[flow.source_id];
            let denom = 1;
            let f:any = null
            switch (flow.media_type) {

                // All Audio formats
                case 'audio/L24':
                case 'audio/L16':
                // L32 = 32-bit container, payload is 24-bit LPCM. Bandwidth
                // calculation uses the full 32 bits per sample.
                case 'audio/L32':
                case 'audio':
                case 'urn:x-nmos:format:audio':
                    // Prefer SDP manifest values when present
                    let sampleRate = flow.sample_rate;
                    if(flow.sample_rate.denominator){
                        denom = flow.sample_rate.denominator;
                    }
                    sampleRate = (flow.sample_rate.numerator || 0) / denom;
                    let channels = (source && Array.isArray(source.channels)) ? source.channels.length : 0;
                    let depth = flow.bit_depth || 0;

                    try{
                        let manifest = this.nmosState.sendersManifestDetail[senderId];
                        if(manifest && Array.isArray(manifest.media)){
                            for(let m of manifest.media){
                                if(m && m.type === "audio" && Array.isArray(m.rtp) && m.rtp.length > 0){
                                    let rtp = m.rtp[0];
                                    if(rtp && rtp.rate){ sampleRate = Number(rtp.rate) || 0; }
                                    if(rtp && rtp.encoding){ channels = Number(rtp.encoding) || channels; }
                                    if(rtp && typeof rtp.codec === "string"){
                                        let codec = rtp.codec.toUpperCase();
                                        if(codec === "L16"){ depth = 16; }
                                        else if(codec === "L24"){ depth = 24; }
                                        else if(codec === "L32"){ depth = 32; }   // 24-bit LPCM in a 32-bit container
                                        else if(codec === "AM824"){ depth = 32; }
                                    }
                                    break;
                                }
                            }
                        }
                    }catch(e){}
                    
                    // TODO VLAN and samples per Packet
                    bitrate = BitrateCalculator.calculateAudio({
                            encoding:"raw",
                            sampleRate: sampleRate,
                            channels: channels,
                            depth: depth,
                            samplesPerPacket:48,
                            vlan:false,
                        }).averageEthernet/1000000
                    bitrateHint = "ok";
                  break;


                // All raw video formats
                case 'video':
                case 'video/raw':
                case 'urn:x-nmos:format:video':
                    if(flow.grain_rate.denominator){
                        denom = flow.grain_rate.denominator;
                      }
                      f = {
                        encoding:"raw",
                        width:flow.frame_width  ,
                        height:flow.frame_height,
                        fps:Math.round(
                            (flow.grain_rate.numerator / flow.grain_rate.denominator) * 100
                          ) /
                            100,
                        interlaced:(flow.interlace_mode != 'progressive'),
                        depth:flow.components[0].bit_depth,
                        sampling:"YCbCr422",
                        gapped: true,
                        gpm:true,
                        shape:"narrow",
                        vlan:false,
                    
                        blanking:"dmt"
                    };
                    bitrate = BitrateCalculator.calculateVideo(f).averageEthernet/1000000
                    bitrateHint = "ok";
                  
                  
                  break;

                case 'video/jxsv':
                    if(flow.grain_rate.denominator){
                        denom = flow.grain_rate.denominator;
                      }
                      f = {
                        encoding:"raw",
                        width:flow.frame_width  ,
                        height:flow.frame_height,
                        fps:Math.round(
                            (flow.grain_rate.numerator / flow.grain_rate.denominator) * 100
                          ) /
                            100,
                        interlaced:(flow.interlace_mode != 'progressive'),
                        depth:flow.components[0].bit_depth,
                        sampling:"YCbCr422",
                        gapped: true,
                        gpm:true,
                        shape:"narrow",
                        vlan:false,
                    
                        blanking:"dmt"
                    };
                    bitrate = BitrateCalculator.calculateVideo(f).averageEthernet/1000000/4
                    bitrateHint = "max";

                break;

                case 'video/smpte291':
                    bitrate = 1;
                    bitrateHint = "max";
                break;

                default:
                  bitrate = 0;
                  bitrateHint = "unknown";
                  break;
              }
            }catch(e){console.log(e)}
            return {v:bitrate,hint:bitrateHint};
    }

    getNmosSenderForamt(senderId: string) {
        let info = '';
        try {
          let sender = this.nmosState.senders[senderId];
          let flow = this.nmosState.flows[sender.flow_id];
          let source = this.nmosState.sources[flow.source_id];
          let denom = 1;
          let transfer = "SDR";
          let rgb = "";
          let depth = 0;
          switch (flow.format) {

            case 'audio':
            case 'urn:x-nmos:format:audio':
                // Prefer the rate from the SDP manifest (a=rtpmap:<pt> <codec>/<rate>/<chan>)
                // since some devices report a stale or default value in their IS-04
                // flow resource (e.g. 44100 even when the actual stream is 48 kHz).
                let sampleRate = flow.sample_rate;
                if(flow.sample_rate.denominator){
                    denom = flow.sample_rate.denominator;
                }
                sampleRate = (flow.sample_rate.numerator || 0) / denom;

                let channels = (source && Array.isArray(source.channels)) ? source.channels.length : 0;
                try{
                    let manifest = this.nmosState.sendersManifestDetail[senderId];
                    if(manifest && Array.isArray(manifest.media)){
                    for(let m of manifest.media){
                        if(m && m.type === "audio" && Array.isArray(m.rtp) && m.rtp.length > 0){
                        let rtp = m.rtp[0];
                        if(rtp && rtp.rate){ sampleRate = Number(rtp.rate) || 0; }
                        if(rtp && rtp.encoding){ channels = Number(rtp.encoding) || channels; }
                        break;
                        }
                    }
                    }
                }catch(e){}
                
                let khz = sampleRate ? Math.round(sampleRate / 100) / 10 : 0; // 1 decimal place
                info +=
                    '' +
                    channels +
                    'Ch ' +
                    (flow.bit_depth || '?') +
                    'bit ' +
                    khz +
                    'kHz';
              break;
            


            case 'video':
            case 'urn:x-nmos:format:video':
              
              if(flow.grain_rate.denominator){
                denom = flow.grain_rate.denominator;
              }
              if(flow.transfer_characteristic){
                transfer = flow.transfer_characteristic;
              }
              if(flow.components[0].name && flow.components[1].name && flow.components[2].name ){
                rgb = flow.components[0].name + flow.components[1].name + flow.components[2].name;
              }
              if(flow.components[0].bit_depth ){
                depth = flow.components[0].bit_depth ;
              }
              let interlace =
                flow.interlace_mode == 'progressive'
                  ? 'p'
                  : flow.interlace_mode == 'interlaced_psf'
                  ? 'psf'
                  : 'i';
              info +=
                '' +
                flow.frame_width +
                'x'+
                flow.frame_height +
                interlace +
                Math.round(
                  (flow.grain_rate.numerator / flow.grain_rate.denominator) * 100
                ) /
                  100;
              info += ' ' + flow.colorspace + ' ' + transfer;
                info += ' ' + rgb;
                info += ' ' + depth + 'Bit';    
              break;


            case 'data':
            case 'urn:x-nmos:format:data':
              if (flow.media_type == 'video/smpte291') {
                info += 'smpte291';
              }
              if (flow.media_type == 'application/json') {
                info += 'websocket';
              }
              else{
                info += 'flow.media.type';
              }
              break;
          }
        } catch (e) {
            // TODO Logging
            //console.log(e)
        }
        return info;
      }



    getNmosReceiverClass(receiverId: string) : "video" | "audio" | "data" | "mqtt" | "websocket" | "audiochannel" | "unknown" {
        try {
          let receiver = this.nmosState.receivers[receiverId];
          // TODO detect disabled sender
          switch (receiver.format) {
            case 'urn:x-nmos:format:audio':
              return 'audio';
            case 'urn:x-nmos:format:video':
              return 'video';
            case 'urn:x-nmos:format:data':
              return 'data';
          }
        } catch (e) {}
        return 'unknown';
    }

    getNmosSenderClass(senderId: string): "video" | "audio" | "data" | "mqtt" | "websocket" | "audiochannel" | "unknown" {
        try {
          let flow = this.nmosState.flows[this.nmosState.senders[senderId].flow_id];
          // TODO detect disabled sender
          switch (flow.format) {
            case 'urn:x-nmos:format:audio':
              return 'audio';
            case 'urn:x-nmos:format:video':
              return 'video';
            case 'urn:x-nmos:format:data':
              return 'data';
          }
        } catch (e) {}
        return 'unknown';
    }



    updateMulticast(){
        let storeChanged = false;
        try{
            if(this.informMulticast == false){
                // Nothing to do....
                return;
            }

            this.informMulticast = false;




            let duplicateMulticast:any = {};
            let activeMulticast:any = {};
            let activeErrors:any = {};

            let todoList:any[] = []



            // -------- NMOS
            for(let senderId in this.nmosState.senderActiveData){
                let nmosId = "nmos_"+senderId
                let activeData = this.nmosState.senderActiveData[senderId];
                let multicast:any[] = [];

                // TODO test errors between SDP and Active...

                let workingOnLeg = false;

                activeData.transport_params.forEach((p, index)=>{
                    multicast.push(p.destination_ip);

                    


                    if(p.destination_ip != ""){
                        if(activeMulticast.hasOwnProperty(p.destination_ip)){
                            // Duplicate....
                            if(duplicateMulticast.hasOwnProperty(p.destination_ip)){
                                duplicateMulticast[p.destination_ip].push(nmosId)
                            }else{
                                duplicateMulticast[p.destination_ip] = [nmosId];
                            }
                            if(!workingOnLeg){
                                // One leg at a time
                                workingOnLeg = true;
                                todoList.push({index,senderId})
                            }
                            
                        }else{
                            activeMulticast[p.destination_ip] = nmosId;
                        }
                    }

                    

                    if(p.destination_ip == "" && this.nmosState.sneders.hasOwnProperty(senderId) && this.nmosState.flows.hasOwnProperty(this.nmosState.senders[senderId].flow_id) ){
                        if(!workingOnLeg){
                            // One leg at a time
                            workingOnLeg = true;
                            todoList.push({index,senderId})
                        }
                    }


                })
            }


            todoList.forEach((t)=>{
                let senderId = t.senderId;
                let nmosId = "nmos_"+senderId;
                let index = t.index;


                let give = "";
                let type = this.nmosState.flows[this.nmosState.senders[senderId].flow_id].format;
                if(type == "urn:x-nmos:format:video" ){
                    type = "video"
                }else if (type == "urn:x-nmos:format:audio"){
                    type = "audio"
                }else{
                    type = "other"
                }


                if(this.storedMulticast.hasOwnProperty(nmosId)){
                    give = ""
                    this.storedMulticast[nmosId].forEach((s)=>{
                        if(s.index == index){
                            give = s.multicast
                        }
                    });

                    if(give != ""){

                        give = this.storedMulticast[nmosId][index]
                        if(activeMulticast.hasOwnProperty(give)){
                            // Search new IP
                            parentPort.postMessage(JSON.stringify({
                                log:{severity:"warn", topic:"Multicast Config", text:"Given multicast address used by other device.",raw:{activeId:activeMulticast[give], givenId:nmosId, multicast:give}}
                            }));
                            
                            // TODO: find UHD and JXS for different ranges
                            
                            while(1){
                                give = this.getRandomMulticastAddress(index,type);
                                if(!this.checkStoredMulticast(give)){
                                    if(!activeMulticast.hasOwnProperty(give)){
                                        break;
                                    }
                                }
                            }
                            if(give != ""){
                                activeMulticast[give] = nmosId;

                                if(this.storedMulticast.hasOwnProperty(nmosId)){
                                    this.storedMulticast[nmosId].forEach((s)=>{
                                        if(s.index == index){
                                            s.multicast = give;
                                        }
                                    });
                                }else{
                                    this.storedMulticast[nmosId] = [];
                                    this.storedMulticast[nmosId].push({index:index, multicast:give})
                                }
                                storeChanged = true;

                                parentPort.postMessage(JSON.stringify({
                                    log:{severity:"info", topic:"Multicast Config", text:"Given multicast address to sender:",raw:{givenId:nmosId, multicast:give}}
                                }));
                                console.log(give,senderId, this.nmosState.senders[senderId].label);
                                if(!this.nmosState.senders[senderId].subscription.active)
                                console.error("inactive")
                                parentPort.postMessage(JSON.stringify({
                                    nmosSetMulticast:{nmosId:senderId, multicast:{legs:[{index:index, multicast:give}]}}
                                }));
                            }
                            return;

                        }
                    }
                }
                // if path did not get multicast
                    
                while(1){
                    // TODO protect loop if no more multicast available
                    give = this.getRandomMulticastAddress(index,type);
                    if(!this.checkStoredMulticast(give)){
                        if(!activeMulticast.hasOwnProperty(give)){
                            break;
                        }
                    }
                }
                if(give != ""){
                    activeMulticast[give] = nmosId;

                    if(this.storedMulticast.hasOwnProperty(nmosId)){
                        this.storedMulticast[nmosId].forEach((s)=>{
                            if(s.index == index){
                                s.multicast = give;
                            }
                        });
                    }else{
                        this.storedMulticast[nmosId] = [];
                        this.storedMulticast[nmosId].push({index:index, multicast:give})
                    }
                    storeChanged = true;

                    parentPort.postMessage(JSON.stringify({
                        log:{severity:"info", topic:"Multicast Config", text:"Given multicast address to sender:",raw:{givenId:nmosId, multicast:give}}
                    }));
                    console.log("Give Multicast:", give,senderId, this.nmosState.senders[senderId].label);
                    if(!this.nmosState.senders[senderId].subscription.active)
                    console.error("inactive")
                    parentPort.postMessage(JSON.stringify({
                        nmosSetMulticast:{nmosId:senderId, multicast:{legs:[{index:index, multicast:give}]}}
                    }));
                }


            })


            //console.log(activeMulticast)
            console.log("multicast done")


            // ------- END NMOS




        }catch(e:any){
            console.error(e)
        }

        if(storeChanged){
            try{
                fs.writeFileSync("./state/multicast.json", JSON.stringify(this.storedMulticast));
            }catch(e:any){
                console.error("Error writing to file: ./state/multicast.json");
            }
        }









    }

    getRandomMulticastAddress(index:number,type:string){
        let mode = "primary"
        if(index == 0){
            mode = "primary"
        }else if(index == 1){
            mode = "secondary"
        }else{
            return "";
        }
        try{
            let range = this.settings.multicastRanges[type][mode];
            let ip = range.split("/")[0].split(".");
            let mask = Number.parseInt(range.split("/")[1]);

            
            let bin_ip:string[] = [];

            let add = (n, size= 8) => {
                let num = Number.parseInt(n).toString(2);


                for(let i = 0; i<8; i++){
                    if(i<num.length){
                        bin_ip.push(num[num.length-i-1])
                    }else{
                        bin_ip.push("0");
                    }
                }

                while (num.length < size) num = "0" + num;
                return num;
            }

            add(ip[3]);
            add(ip[2]);
            add(ip[1]);
            add(ip[0]);

            for(let i = 0;i<mask; i++){
                bin_ip[i] = (Math.random()>0.5? "1":"0")
            }

            

            let give = ""
            for(let i = 0; i<4; i++){
                let part = "";
                for(let y = 0; y<8; y++){
                    part = bin_ip[i*8+y] + part;
                }
                if(i!=0){
                    give = "."+give
                }
                give = Number.parseInt(part,2) + give
            }



            return give;


        }catch(e:any){
            console.log(e)
        }

        return "";
    }


    checkStoredMulticast(ip:string){
        for(let s in this.storedMulticast){
            for(let e of this.storedMulticast[s]){
                if(e.multicast == ip){
                    return true;
                }
            }
        }
        return false;
    }


}

let updateThread = new CrosspointUpdateThread();


    

    



