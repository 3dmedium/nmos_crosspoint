import { CrosspointDevice, CrosspointFlow, CrosspointShadowState, CrosspointState } from "./crosspointAbstraction";
import { ComplexCompare, ShortenNames } from "./functions";

import { BitrateCalculator } from "./bitrateHelper/BitrateCalculator"

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

    
    // TODO Config
    nmosUseGroupHints = true;

    constructor(){
        parentPort.on('message', (message) => {
            let data = JSON.parse(message);
            this.update(data);
        });

        try {
            let rawFile = fs.readFileSync("./state/crosspoint.json");
            this.crosspointShadow = JSON.parse(rawFile);
        } catch (e) {
            parentPort.postMessage(JSON.stringify({
                log:{severity:"error", topic:"Crosspoint Settings", text:"Error while reading file: ./config/crosspoint.json", raw:null}
            }));
        }

        try {
            let rawFile = fs.readFileSync("./state/alias.json");
            this.crosspointAlias = JSON.parse(rawFile);
        } catch (e) {
            parentPort.postMessage(JSON.stringify({
                log:{severity:"error", topic:"Crosspoint Settings", text:"Error while reading file: ./config/alias.json", raw:null}
            }));
        }

        try {
            let rawFile = fs.readFileSync("./state/hidden.json");
            this.crosspointHidden = JSON.parse(rawFile);
        } catch (e) {
            parentPort.postMessage(JSON.stringify({
                log:{severity:"error", topic:"Crosspoint Settings", text:"Error while reading file: ./config/hidden.json", raw:null}
            }));
        }

        for (let d of Object.values(this.crosspointShadow.devices)) {
            if(d.num >= this.nextDeviceNum){
                this.nextDeviceNum = d.num+1;
            }
        }
    }


    updateRequest = 0;
    updateTimeout:any = null;
    update(data:any){

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
            }catch(e){
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
            }catch(e){
                console.error("Error writing to file: ./state/hidden.json");
            }

            return;
        }

        if(this.updateRequest >0){
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

        for(let devId in this.crosspointShadow){
            if(devId.startsWith("nmosgrp_")){
                this.crosspointShadow[devId].available = false;
            }
        }
        if(this.nmosState){
            // NMOS Senders

            // alphabetical sorting....
            let list = [];
            for (let s of Object.values(this.nmosState.senders)) {
                list.push(s)
            };
            
            list = list.sort((a,b)=>{
                return ComplexCompare(a.label,b.label);
            })
            for (let s of list) {
                let send:any = s;

                let groupId = "";
                let groupHint = false;
                let groupLabel = "";

                if(this.nmosUseGroupHints && send.hasOwnProperty('tags') && send.tags.hasOwnProperty("urn:x-nmos:tag:grouphint/v1.0") && Array.isArray(send.tags["urn:x-nmos:tag:grouphint/v1.0"]) && send.tags["urn:x-nmos:tag:grouphint/v1.0"].length > 0){
                    let group = (send.tags["urn:x-nmos:tag:grouphint/v1.0"][0] as string).split(':')[0];
                    groupId = 'nmosgrp_' +md5(group+send.device_id);
                    groupHint = true;
                    if(this.nmosState.devices.hasOwnProperty(send.device_id)){

                        // If device is new, check naming
                        let groupLabels:string[] = [];
                        this.nmosState.devices[send.device_id].senders.forEach((id:string)=>{
                            if(this.nmosState.senders[id]){
                                let otherSender = this.nmosState.senders[id]
                                if(otherSender.hasOwnProperty('tags') && otherSender.tags.hasOwnProperty("urn:x-nmos:tag:grouphint/v1.0") && Array.isArray(otherSender.tags["urn:x-nmos:tag:grouphint/v1.0"]) && otherSender.tags["urn:x-nmos:tag:grouphint/v1.0"].length > 0  ) {
                                    let otherGroup = (otherSender.tags["urn:x-nmos:tag:grouphint/v1.0"][0] as string).split(':')[0];
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
                this.crosspointShadow.devices[groupId]["available"] = true;

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

                    }else{
                        //update
                        if(this.crosspointShadow.devices[groupId].senders[type]["nmos_"+send.id].name != send.label){
                            this.crosspointShadow.devices[groupId].senders[type]["nmos_"+send.id].name = send.label;
                            changed = true;
                        }
                        
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
                let recv:any = r;

                let groupId = "";
                let groupHint = false;
                let groupLabel = "";

                if(this.nmosUseGroupHints && recv.hasOwnProperty('tags') && recv.tags.hasOwnProperty("urn:x-nmos:tag:grouphint/v1.0") && Array.isArray(recv.tags["urn:x-nmos:tag:grouphint/v1.0"]) && recv.tags["urn:x-nmos:tag:grouphint/v1.0"].length > 0){
                    let group = (recv.tags["urn:x-nmos:tag:grouphint/v1.0"][0] as string).split(':')[0];
                    let flowNameFromGroup = (recv.tags["urn:x-nmos:tag:grouphint/v1.0"][0] as string).split(':')[1];
                    groupId = 'nmosgrp_' +md5(group+recv.device_id);
                    groupHint = true;
                    if(this.nmosState.devices.hasOwnProperty(recv.device_id)){




                        // If device is new, check naming
                        let groupLabels:string[] = [];
                        this.nmosState.devices[recv.device_id].senders.forEach((id:string)=>{
                            if(this.nmosState.receivers[id]){
                                let otherReceiver = this.nmosState.receivers[id]
                                if(otherReceiver.hasOwnProperty('tags') && otherReceiver.tags.hasOwnProperty("urn:x-nmos:tag:grouphint/v1.0") && Array.isArray(otherReceiver.tags["urn:x-nmos:tag:grouphint/v1.0"]) && otherReceiver.tags["urn:x-nmos:tag:grouphint/v1.0"].length > 0  ) {
                                    let otherGroup = (otherReceiver.tags["urn:x-nmos:tag:grouphint/v1.0"][0] as string).split(':')[0];
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


                this.crosspointShadow.devices[groupId]["available"] = true;

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
            }
        }


        


        if(changed){
            parentPort.postMessage(JSON.stringify({
                log:{severity:"info", topic:"Crosspoint", text:"Shadow State was modified.", raw:null}
            }));
            try{
                fs.writeFileSync("./state/crosspoint.json", JSON.stringify(this.crosspointShadow));
            }catch(e){
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
            let device: CrosspointDevice = {
                id:dev.id,
                num:dev.num,
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
                receivers:{ audio:[],audiochannel:[],video:[],data:[],websocket:[],mqtt:[],  unknown:[] }
            }
            if(dev.id.startsWith("nmosgrp_")){
                device.available = dev["available"];
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
                            type:send.type,
                            alias:send.name,
                            connectedFlow:"",
                            hidden:(this.crosspointHidden.hasOwnProperty(send.id)),
                            available:false,
                            active:false,
                            sourceNumber:-1,
                            channelNumber:-1,
                            manifestOk:false,
                            capabilities:{mediaTypes:[],transport:"", dash7:false},
                            capLimits:"",
                            format:"",
                            bitrate:{v:0, hint:"unknown"}
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
                                    source.active = this.nmosState.senders[nmosId].subscription.active
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
                            type:recv.type,
                            alias:recv.name,
                            connectedFlow:"",
                            hidden:(this.crosspointHidden.hasOwnProperty(recv.id)),
                            available:false,
                            active:false,
                            sourceNumber:-1,
                            channelNumber:-1,
                            manifestOk:false,
                            capabilities:{mediaTypes:[],transport:"", dash7:false},
                            capLimits:"cpa Limits",
                            format:"",
                            bitrate:{v:0, hint:"unknown"}
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
                                    receiver.active = this.nmosState.receivers[nmosId].subscription.active
                                    receiver.capabilities.mediaTypes = this.nmosState.receivers[nmosId].caps.media_types;
                                    if( this.nmosState.receivers[nmosId].subscription.active && this.nmosState.receivers[nmosId].subscription.sender_id){
                                        receiver.connectedFlow = "nmos_"+this.nmosState.receivers[nmosId].subscription.sender_id;
                                        device.connectedFlows.push("nmos_"+this.nmosState.receivers[nmosId].subscription.sender_id);
                                    }
                                }
                            }
                        }
                        device.receivers[recv.type].push(receiver);
                    }

                }
            }

            this.crosspointState.devices.push(device);
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

            
                case 'audio/L24':
                case 'audio/L16':
                case 'audio':
                case 'urn:x-nmos:format:audio':
                    if(flow.sample_rate.denominator){
                        denom = flow.sample_rate.denominator;
                    }
                    // TODO VLAN and samples per Packet
                    bitrate = BitrateCalculator.calculateAudio({
                            encoding:"raw",
                            sampleRate:flow.sample_rate.numerator / denom,
                            channels:source.channels.length,
                            depth:flow.bit_depth,
                            samplesPerPacket:48,
                            vlan:false,
                        }).averageEthernet/1000000
                    bitrateHint = "ok";
                  break;
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
            
            case 'urn:x-nmos:format:audio':
    
              if(flow.sample_rate.denominator){
                denom = flow.sample_rate.denominator;
              }
              info +=
                '' +
                source.channels.length +
                'Ch ' +
                flow.bit_depth +
                'bit ' +
                Math.floor(
                  flow.sample_rate.numerator / denom / 1000
                ) +
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


}

let updateThread = new CrosspointUpdateThread();


    

    



