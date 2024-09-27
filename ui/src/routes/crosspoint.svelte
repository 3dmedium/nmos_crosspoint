<script lang="ts">
    import type { Source } from "postcss";
    import ServerConnector from "../lib/ServerConnector/ServerConnectorService"
      import type { Subject } from "rxjs";
      import { onDestroy, onMount } from "svelte";
      import { createEventDispatcher } from 'svelte';

      import { Icon, ChevronRight, VideoCamera, Microphone, CodeBracketSquare, MagnifyingGlass,  SpeakerWave, Tv,Pencil, Eye, EyeSlash, Link, InformationCircle } from "svelte-hero-icons";
    import { getSearchTokens, tokenSearch } from "../lib/functions";
    import OverlayMenuService from "../lib/OverlayMenu/OverlayMenuService";
    
      interface CrosspointConnect {
        source:string,
        destination:string
      };
  
    let senders:any[] = [];
    let receivers:any[] = [];
    let sourceState:any = {}

    let trigerUpdate = "";

    export let autoTake = true;
    const dispatch = createEventDispatcher();
    


    let filter:any = {
      version:11238,
      showUnavailable:false,
      showHidden: false,
      searchReceivers:"",
      searchSenders:"",
      expanded: { senders :[], receivers :[]}
    };

    let searchExpandedReceivers:string[] = [];
    let searchExpandedSenders:string[] = [];
  
    let sync:Subject<any> ;

    let flowTypes = ["video", "audio", "data", "mqtt", "websocket", "audiochannel", "unknown"];


    function getFlowTypeIcon(type:any, source=true){
      if(source){
        switch(type){
          case "video":
            return VideoCamera;
            break;
          case "audio":
          case "audiochannel":
            return Microphone;
            break;
          case "data":
          case "mqtt":
          case "websocket":
            return CodeBracketSquare;
            break;
          default:
              return "";
              break;
        }
      }else{
        switch(type){
          case "video":
            return Tv;
            break;
          case "audio":
          case "audiochannel":
            return SpeakerWave;
            break;
          case "data":
          case "mqtt":
          case "websocket":
            return CodeBracketSquare;
            break;
          default:
              return "";
              break;
        }
      }
    }
  
    onMount(async () => {
      try{
        let f = localStorage.getItem("nmos_crosspoint_filter");
        if(f){
          let tempFilter = JSON.parse(f);
          if(tempFilter.version == filter.version){
            filter = tempFilter;
          }else{
            console.log("Resetting crosspoint filter localstorage.");
            saveFilter();
          }
        }
      }catch(e){}

      sync = ServerConnector.sync("crosspoint");
      sync.subscribe((obj:any)=>{
        sourceState = obj;
        doFilter();
      });
    });

    function changeFilter(){
      setTimeout(()=>{
      doFilter();

      saveFilter();
    },10)
    }

    function doFilter (){
      senders = [];
      receivers = [];
      searchExpandedReceivers = [];
      searchExpandedSenders = [];

      if(sourceState.devices){
        sourceState.devices.forEach((dev:any)=>{
          let count = 0;
          flowTypes.forEach((type)=>{
            count+= dev.senders[type].length;
          })
          if(count > 0){
            let d = structuredClone(dev);
            d.receivers = undefined
            senders.push(d);
          }
        })

        sourceState.devices.forEach((dev:any)=>{
          let count = 0;
          flowTypes.forEach((type)=>{
            count+= dev.receivers[type].length;
          })
          if(count > 0){
            let d = structuredClone(dev)
            d.senders = undefined
            receivers.push(d);
          }
        })

        if(!filter.showUnavailable){
          receivers = receivers.filter((dev)=>{
            flowTypes.forEach((type)=>{
              dev.receivers[type] = dev.receivers[type].filter((flow:any)=>{
                if(flow.available){
                  return true;
                }
                return false;
              });
            });

            let count = 0;
            flowTypes.forEach((type)=>{
              count+= dev.receivers[type].length;
            })
            if(count > 0){
              return true;
            }
            return false;
          });

          senders = senders.filter((dev)=>{
            flowTypes.forEach((type)=>{
              dev.senders[type] = dev.senders[type].filter((flow:any)=>{
                if(flow.available){
                  return true;
                }
                return false;
              });
            });

            let count = 0;
            flowTypes.forEach((type)=>{
              count+= dev.senders[type].length;
            })
            if(count > 0){
              return true;
            }
            return false;
          });
        }

        if(!filter.showHidden){
          receivers = receivers.filter((dev)=>{
            if(dev.hidden){
              return false;
            }
            flowTypes.forEach((type)=>{
              dev.receivers[type] = dev.receivers[type].filter((flow:any)=>{
                if(flow.hidden){
                  return false;
                }
                return true;
              });
            });
            return true
          });

          senders = senders.filter((dev)=>{
            if(dev.hidden){
              return false;
            }
            flowTypes.forEach((type)=>{
              dev.senders[type] = dev.senders[type].filter((flow:any)=>{
                if(flow.hidden){
                  return false;
                }
                return true;
              });
            });
            return true;
          });
        }

        // Search
        if(filter.searchReceivers != ""){
          let searchTokens = getSearchTokens(filter.searchReceivers);
          receivers = receivers.filter((dev:any)=>{
            let flowFound = false;
            for(let type in dev.receivers){
              
              // TODO mybe add original Name to search fields?
              dev.receivers[type].filter((recv:any)=>{
                let found = tokenSearch(recv, searchTokens, ["alias", "name"]);
                if(found){
                  flowFound = true;
                }
                return found;
              });

              
            }
            let self = tokenSearch(dev, searchTokens, ["alias", "name"]);
            if(flowFound && !self){
              searchExpandedReceivers.push(dev.id);
            }

            
            if(flowFound || self ){
              return true;
            }
            return false;
          }); 
        }

        if(filter.searchSenders != ""){
          let searchTokens = getSearchTokens(filter.searchSenders);
          senders = senders.filter((dev:any)=>{
            let flowFound = false;
            for(let type in dev.senders){
              
              // TODO mybe add original Name to search fields?
              dev.senders[type].filter((send:any)=>{
                let found = tokenSearch(send, searchTokens, ["alias", "name"]);
                if(found){
                  flowFound = true;
                }
                return found;
              });

              
            }
            let self = tokenSearch(dev, searchTokens, ["alias", "name"]);
            if(flowFound && !self){
              searchExpandedSenders.push(dev.id);
            }

            
            if(flowFound || self ){
              return true;
            }
            return false;
          }); 
        }
    }
      
    }
    function isSenderExpanded(id:string){
      if(searchExpandedSenders.includes(id)){
        return true;
      }
      if(filter.expanded.senders.includes(id)){
        return true;
      }
      return false;
    }
    function isReceiverExpanded(id:string){
      if(searchExpandedReceivers.includes(id)){
        return true;
      }
      if(filter.expanded.receivers.includes(id)){
        return true;
      }
      return false;
    }

    function toggleExpandSender(id:string){
      let index = searchExpandedSenders.indexOf(id);
      if(index != -1){
        searchExpandedSenders.splice(index,1);
      }
      index = filter.expanded.senders.indexOf(id);
      if(index == -1){
        filter.expanded.senders.push(id);
      }else{
        filter.expanded.senders.splice(index,1);
      }
      
      saveFilter();
      senders = [...senders]
    }

    function toggleExpandReceiver(id:string){

      let index = searchExpandedReceivers.indexOf(id);
      if(index != -1){
        searchExpandedReceivers.splice(index,1);
      }
      index = filter.expanded.receivers.indexOf(id);
      if(index == -1){
        filter.expanded.receivers.push(id);
      }else{
        filter.expanded.receivers.splice(index,1);
      }
      saveFilter();
      receivers = [...receivers]
      
    }


    function saveFilter(){
      localStorage.setItem("nmos_crosspoint_filter", JSON.stringify(filter));
    }
  
    onDestroy(() => {
      sync.unsubscribe();
          ServerConnector.unsync("crosspoint")
      });

 


    function receiverCapable(dest:any, src:any){
      if(dest.type == src.type){
        return true;
      }
      return false;
    }


    function connect (srcDev:any,src:any,dstDev:any, dst:any, force = false) {
     


        if(src && dst){
          let newList = [];
          newList.push({
            srcDev:srcDev,
            src:src,
            dstDev:dstDev,
            dst:dst
          })
          cleanPreparedConnections(newList);
          receivers = [... receivers]
          if(autoTake){
              takeConnect();
            }
        }else{
          let srcString = getDevcieNameString(srcDev,src);
          let dstString = getDevcieNameString(dstDev,dst);
      
          ServerConnector.post("makeconnection", {
            prepare:true,
            source:srcString,
            destination:dstString
          }).then((response)=>{
            let newList = []
            response.data.connections.forEach((c)=>{
              newList.push({
                srcDev:c.srcDev,
                src:c.src,
                dstDev:c.dstDev,
                dst:c.dst
              })
            })
            cleanPreparedConnections(newList);
            receivers = [...receivers]
            if(autoTake){
              takeConnect();
            }
          }).catch((e)=>{
            // TODO, error handling
            ServerConnector.addFeedback({
              message:"Can not connect: "+e.message,
              level:"error"
            })
            console.log(e)
          })
        }
    }


    export function takeConnect(){
      doConnect(preparedConnectList);
      workingConnectList = preparedConnectList;
      preparedConnectList = [];
      receivers = [...receivers]
      updateGlobalTake();
    }




    let preparedModal:any;
    export function openPreparedConnectModal(){
      preparedModal.showModal();
    }

    export function clearConnect( dstId : string = ""){
      if(dstId == ""){
        preparedConnectList = [];
        receivers = [...receivers];
      }else{
        preparedConnectList = preparedConnectList.filter((c)=>{
          if(dstId == c.dst.id){
            return false
          }else{
            return true
          }
        });
        receivers = [...receivers];
      }
      updateGlobalTake();
    }

    function cleanPreparedConnections(newList){
      preparedConnectList = preparedConnectList.filter((c)=>{
        for(let n of newList){
          if(n.dst.id == c.dst.id){
            return false;
          }else{

          }
        }
        return true;
          
      })
      newList.forEach((n)=>{
        preparedConnectList.push(n);
      })

      updateGlobalTake();
    }

    let previewTimer:any = null;
    
    function getDeviceConnectionPreview(srcDev:any,src:any,dstDev:any, dst:any){
      
      previewTimer = setTimeout(()=>{
        previewTimer = null;
        previewConnect(srcDev,src,dstDev,dst);
      },200)

    }
    function clearDeviceConnectionPreview(){
      if(previewTimer){
        clearTimeout(previewTimer);
        previewTimer = null;
        previewConnectList = []
        
      }else{
        if(previewConnectList.length > 0){
          previewConnectList = []
          receivers = [...receivers]
        }else{
          previewConnectList = []
        }
      }
      updateGlobalTake();
    }

    function getDevcieNameString(dev:any,flow:any){
      let ret = "";

      if(dev){
        ret+=dev.num
        if(flow){
          ret+= "."+renderFlowTypeShort(flow.type) + "" +flow.num
        }
      }
      return ret;
    }

    function previewConnect(srcDev:any,src:any,dstDev:any, dst:any) {
      let srcString = getDevcieNameString(srcDev,src);
      let dstString = getDevcieNameString(dstDev,dst);
      
      ServerConnector.post("makeconnection", {
        preview:true,
        source:srcString,
        destination:dstString
      }).then((response)=>{
        previewConnectList = [];
        response.data.connections.forEach((c)=>{
          previewConnectList.push({src:c.src, dst:c.dst})
          
        })
        receivers = [...receivers]
        updateGlobalTake();
      }).catch((e)=>{
        console.log(e)
      })
    }

    
    function doConnect(list:any[]) {
      let reducedList:any[] = [];
      list.forEach((l)=>{
        let srcString = getDevcieNameString(l.srcDev,l.src);
        let dstString = getDevcieNameString(l.dstDev,l.dst);
        reducedList.push({
          source:srcString,
          destination:dstString
        })
      });
      
      // TODO Activating....
      ServerConnector.post("makeconnection", {multiple:reducedList,preview:false}).then((response:any)=>{
        showConnectResponse(response.data);
        workingConnectList = [];
        receivers = [...receivers];
      }).catch((e)=>{
        workingConnectList = [];
        receivers = [...receivers];
      });
      // TODO error
    }

    let preparedConnectList :any[] = [];
    let previewConnectList:any[] = [];
    let workingConnectList:any[] = [];

    function updateGlobalTake(){
      dispatch("updateGlobalTake",{prepared:preparedConnectList, preview:previewConnectList});
    }

    function renderFlowTypeShort(type:string){
      switch(type){
          case "video":
            return "v";
            break;
          case "audio":
            return "a";
            break;
          case "data":
            return "d";
            break;
          default:
            return "u";
        }
    }
    
    function getDisconnectClass(dev:any,flow:any){
      for(let c of preparedConnectList){
        if(!c.src && c.dst){
            if( flow.id == c.dst ){
              return "prepareddisconnect"
            }
        }
      }

      for(let c of workingConnectList){
        if(!c.src && c.dst){
            if( flow.id == c.dst ){
              return "workingdisconnect"
            }
        }
      }

      for(let c of previewConnectList){
        if(!c.src && c.dst){
            if( flow.id == c.dst ){
              return "previewdisconnect"
            }
        }
      }

      return false
    }

    function getConnectClass(srcDev:any,src:any,dstDev:any, dst:any){
      for(let c of preparedConnectList){
        if(c.src && c.dst){


          if(src && dst){
              if( src.id == c.src.id && dst.id == c.dst.id ){
                return "prepared"
              }
          }


          if(!src && !dst){
            for(let r of dstDev.receiverIds){
              for(let s of srcDev.senderIds){
                if(r == c.dst.id && s == c.src.id){
                  return "prepared"
                }
              }
            }
          }

           
        }
      }

      for(let c of workingConnectList){
        if(c.src && c.dst){


          if(src && dst){
              if( src.id == c.src.id && dst.id == c.dst.id ){
                return "working"
              }
          }


          if(!src && !dst){
            for(let r of dstDev.receiverIds){
              for(let s of srcDev.senderIds){
                if(r == c.dst.id && s == c.src.id){
                  return "working"
                }
              }
            }
          }

           
        }
      }

      for(let c of previewConnectList){
        if(src && dst && c.src && c.dst){
            if( src.id == c.src && dst.id == c.dst ){
              return "preview"
            }
        }
      }

      if(src && dst){
        if(src.id == dst.connectedFlow){
          return "active"
        }
      }else{
        for(let type in srcDev.senders){
          for(let flow of srcDev.senders[type]){
            if(dstDev.connectedFlows.includes(flow.id)){
              return "active"
            }
          }
        }
      }

      return "";
    }

    function gotoLog(log:string){
      log = log.slice(5);
      let params = new URLSearchParams({filterIds: log});
      document.location.href = "/logging?" + params.toString();
    }

    
    function showConnectResponse(data:any){
      let result:any = {success:0, disconnect:0, failed:0, reasons:[], log:"ids"}
      data.connections.forEach((c:any)=>{
        if(c.status == "ok"){
          result.success ++;
        }else if(c.status == "ok_dis"){
          result.disconnect ++;
        }else{
          result.failed ++;

          if(!result.reasons.includes(c.detail.message)){
            result.reasons.push(c.detail.message);
          }

          if(c.detail.log != ""){
            result.log += "||" + c.detail.log
          }

        }
        
      })
      let feedback:any ={ level:"neutral",
        time:7000,
        message:"Connection Feedback",
        data:{
          type:"connection",
          result:result
        }
      }
      if(result.failed > 0 ){

        feedback.time = 15000
      }
      if(result.failed > 0 && result.success == 0){

        feedback.time = 15000
      }
      if(result.log != "ids"){
        feedback["click"] = ()=>{gotoLog(result.log);}
      }
      ServerConnector.addFeedback(feedback)
    }

    function activate(dev:any, flow:any){
      // TODO
    }

    function toggleHidden(id:string){
      ServerConnector.post("togglehidden", {
        id:id
      }).finally(()=>{})
    }

    function shortCaps(caps){
      return "Limits: Unknown";
    }

    function shortFormat(format:any){
      return format;
    }


    function editFlowLabel(flow:any){
      openLabelEditor(flow.id, flow.name, flow.alias)
    }

    function editDevLabel(dev:any){
      openLabelEditor(dev.id, dev.name, dev.alias)
    }


    let labelModal;
      let labelModalInput;
      let labelModalId:string = "";
      let labelModalName:string = "";
      let labelModalAlias:string = "";
      let labelModalValue:string = "";
      function openLabelEditor(id:string, name:string, alias:string){
        labelModalId = id;
        labelModalName = name;
        labelModalAlias = alias;
        labelModalValue = alias;
        labelModal.showModal();
        labelModalInput.focus();
        setTimeout(()=>{
          labelModalInput.select();
        })
        
      }
      function changeLabelSend(){
        ServerConnector.post("changealias",{id:labelModalId, alias:labelModalValue})
        labelModal.close()
      }



    
  </script>
  <div class="content-container crosspoint">
    <ul class="menu bg-base-200 menu-horizontal rounded-box filter-nav">
      <li>
        <label class="input input-ghost flex gap-2">
          <input bind:value={filter.searchReceivers} on:input={()=>changeFilter()} type="text" class="grow" placeholder="Search Receivers" />
          <Icon src={MagnifyingGlass}></Icon>
        </label>
      </li> 

      <li>
        <label class="input input-ghost flex gap-2">
          <input bind:value={filter.searchSenders} on:input={()=>changeFilter()} type="text" class="grow" placeholder="Search Senders" />
          <Icon src={MagnifyingGlass}></Icon>
        </label>
      </li> 


      <li>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">Show unavailable</span> 
          <input on:input={()=>changeFilter()} bind:checked={filter.showUnavailable} type="checkbox" class="toggle" />
        </label>
      </li>

      <li>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">Show hidden</span> 
          <input on:input={()=>changeFilter()} bind:checked={filter.showHidden} type="checkbox" class="toggle" />
        </label>
      </li>
    </ul>


    <div class="cp-container">
      <div class="cp-limit-container">
      
      <div class="cp-header-cross"></div>
</div>
      <table class="cp-table">
        <thead>
                <tr>
                    <th class=""></th>
                    {#each senders as dev}
                      <th class="cp-device" class:expanded={isSenderExpanded(dev.id)} on:click={()=>toggleExpandSender(dev.id)}><!--
                        --><span class="cp-expand"><Icon src={ChevronRight}></Icon></span><!--
                        --><span class="cp-label {(dev.hidden?"hidden":"")}">{dev.alias}<!--
                        --><span class="cp-edit">
                          <span on:click={(e)=>{e.stopPropagation(); editDevLabel(dev);}} class="cp-button cp-button-edit" use:OverlayMenuService.tooltip data-tooltip="change alias"><Icon src={Pencil}></Icon></span>
                          <span on:click={(e)=>{e.stopPropagation(); toggleHidden(dev.id);}} class="cp-button cp-button-visible" use:OverlayMenuService.tooltip data-tooltip="toggle hidden"><Icon src={(dev.hidden ? Eye : EyeSlash)}></Icon></span>
                          
                        </span></span><!--
                        --><span class="cp-type-spacer"></span><!--
                      --></th>
                      {#if isSenderExpanded(dev.id)}
                        {#each flowTypes as type}
                          {#each dev.senders[type] as flow}
                            <th class="cp-flow"><!--
                              --><span class="cp-expand"></span><!--
                              --><span class="cp-label {(flow.hidden?"hidden":"")}">{flow.alias}<!--
                                --><span class="cp-edit">
                                  <span on:click={()=>editFlowLabel(flow)} class="cp-button cp-button-edit" use:OverlayMenuService.tooltip data-tooltip="change alias"><Icon src={Pencil}></Icon></span>
                                  <span on:click={()=>toggleHidden(flow.id)} class="cp-button cp-button-visible" use:OverlayMenuService.tooltip data-tooltip="toggle hidden"><Icon src={(flow.hidden ? Eye : EyeSlash)}></Icon></span>
                                  <span on:click={()=>activate(dev,flow)} class="cp-button cp-button-disconnect" use:OverlayMenuService.tooltip data-tooltip="toggle activate"><Icon src={Link}></Icon></span>
                                </span><!--
                                --></span><!--
                              --><span class={"cp-type cp-type-"+flow.type + " " + (flow.active ? "active" : "") }><Icon src={getFlowTypeIcon(flow.type)}></Icon><!--
                                --><span class="cp-detail">{flow.format ? shortFormat(flow.format) : (flow.available ? "Unknown format": "Unavailable")}</span><!--
                              --></span><!--
                              
                            --></th>
                          {/each}
                        {/each}
                      {/if}
                    {/each}
                </tr>
            </thead>
            <tbody>
              {#each receivers as dev}
                <tr class="cp-device" class:expanded={isReceiverExpanded(dev.id)}>
                  <td class="cp-line-stick" on:click={()=>toggleExpandReceiver(dev.id)}><!--
                    --><span class="cp-expand"><Icon src={ChevronRight}></Icon></span><!--
                    --><span class="cp-label {(dev.hidden?"hidden":"")}">{dev.alias}<!--
                        --><span class="cp-edit">
                          <span on:click={(e)=>{e.stopPropagation(); editDevLabel(dev);}} class="cp-button cp-button-edit" use:OverlayMenuService.tooltip  data-tooltip="change alias"><Icon src={Pencil}></Icon></span>
                          <span on:click={(e)=>{e.stopPropagation(); toggleHidden(dev.id);}} class="cp-button cp-button-visible" use:OverlayMenuService.tooltip data-tooltip="toggle hidden"><Icon src={(dev.hidden ? Eye : EyeSlash)}></Icon></span>
                          <span on:click={(e)=>{e.stopPropagation(); connect(null, null, dev,null);}} class="cp-button cp-button-disconnect" use:OverlayMenuService.tooltip data-tooltip="disconnect"><Icon src={Link}></Icon></span>
                        </span><!--
                    --></span><!--
                  --></td>

                  {#each senders as sourceDev}
                      <td class="cp-connect-device"><div><span class="{ getConnectClass(sourceDev, null, dev, null)}"
                                  on:click={()=>connect( sourceDev, null, dev, null)}
                                  on:mouseover={()=>getDeviceConnectionPreview(sourceDev, null, dev, null)} 
                                  on:mouseleave={()=>clearDeviceConnectionPreview()} ></span></div></td>
                      {#if isSenderExpanded(sourceDev.id)}
                        {#each flowTypes as type}
                          {#each sourceDev.senders[type] as sourceFlow}
                          <td class="cp-connect-device"><div><span 
                                  on:click={()=>connect( sourceDev, sourceFlow, dev, null)}
                                  on:mouseover={()=>getDeviceConnectionPreview(sourceDev, sourceFlow, dev, null)}
                                  on:mouseleave={()=>clearDeviceConnectionPreview()}></span></div></td>
                          {/each}
                        {/each}
                      {/if}
                    {/each}


                </tr>
                {#if isReceiverExpanded(dev.id)}

                {#each flowTypes as type}
                  {#each dev.receivers[type] as flow}
                    <tr class="cp-flow">
                      <td class="cp-line-stick">
                        <span class="cp-expand"></span><!--
                        --><span class="cp-label {(flow.hidden?"hidden":"")}">{flow.alias}<!--
                        --><span class="cp-edit">
                          <span on:click={()=>editFlowLabel(flow)} class="cp-button cp-button-edit" use:OverlayMenuService.tooltip  data-tooltip="change alias"><Icon src={Pencil}></Icon></span>
                          <span on:click={()=>toggleHidden(flow.id)} class="cp-button cp-button-visible" use:OverlayMenuService.tooltip  data-tooltip="toggle hidden"><Icon src={(flow.hidden ? Eye : EyeSlash)}></Icon></span>
                          <span on:click={()=>connect(null, null, dev,flow)} class="cp-button cp-button-disconnect" use:OverlayMenuService.tooltip  data-tooltip="disconnect"><Icon src={Link}></Icon></span>
                        </span><!--
                        --></span><!--
                        --><span class={"cp-type cp-type-"+flow.type + " " + getDisconnectClass(dev,flow) + " " + (flow.active ? "active" : "")}><Icon src={getFlowTypeIcon(flow.type, false)}></Icon><!--
                          --><span class="cp-detail">{shortCaps(flow.capLimits)}</span><!--
                        --></span><!--
                      --></td>



                      {#each senders as sourceDev}
                      <td class="cp-connect-device"><div><span 
                              on:click={()=>connect( sourceDev, null, dev, flow) } 
                              on:mouseover={()=>getDeviceConnectionPreview(sourceDev, null, dev, flow) } 
                              on:mouseleave={()=>clearDeviceConnectionPreview()} ></span></div></td>
                      {#if isSenderExpanded(sourceDev.id)}
                        {#each flowTypes as type}
                          {#each sourceDev.senders[type] as sourceFlow}
                            {#if receiverCapable(flow, sourceFlow) }
                            <td class="cp-connect-flow"><div><span class="{ getConnectClass(sourceDev, sourceFlow, dev, flow)}" 
                              on:click={()=>connect( sourceDev, sourceFlow, dev, flow) }></span></div></td>
                            {:else}
                            <td class="cp-connect-mismatch"><div></div></td>
                            {/if}
                          {/each}
                        {/each}
                      {/if}
                    {/each}




                    </tr>
                  {/each}
                {/each}
                {/if}
              {/each}
            </tbody>
    </table>
    
    </div>

    </div>


    <dialog bind:this={labelModal} class="modal">
      <div class="modal-box">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 class="font-bold text-lg">Change Alias</h3>
        <span>Source Name: {labelModalName}</span><br/>
        <span>Alias: {labelModalAlias}</span>
          <input on:keypress={(e)=>{if(e.keyCode == 13) changeLabelSend()}} bind:this={labelModalInput} bind:value={labelModalValue} type="text" placeholder="Type here" class="input input-bordered w-full max-w-xs" />
        <div class="modal-action">
          <form method="dialog">
            <!-- if there is a button in form, it will close the modal -->
            <button on:click={()=>{labelModalValue = ""; changeLabelSend()}} class="btn" >Remove</button>
            <button on:click={()=>{changeLabelSend()}} class="btn" >Save</button>
            <button class="btn">Close</button>
          </form>
        </div>
      </div>
    </dialog>

    <dialog bind:this={preparedModal} class="modal">
      <div class="modal-box" style="max-width:80%;">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 class="font-bold text-lg">Prepared Connections</h3>
        
        <table>

          <thead>
            <tr>
              <td>Destination</td>
              <td></td>

              <td></td>

              <td>Source</td>
              <td></td>

              <td></td>
            </tr>
          </thead>

          <tbody>
            {#each preparedConnectList as prep}
              <tr>
                <td>{prep.dstDev?.alias}</td>
                <td>{prep.dst?.alias}</td>
                <td style="padding:0px 10px">{"<"}</td>
                <td>{(prep.srcDev ? prep.srcDev.alias:"Disconnect")}</td>
                <td>{(prep.src ? prep.src.alias:"")}</td>

                <td>
                  <button on:click={()=>{ clearConnect(prep.dst.id) }} class="btn" >Clear</button>
                </td>
              </tr>
            {/each}
          </tbody>

        </table>

        <div class="modal-action">
          <form method="dialog">
            <!-- if there is a button in form, it will close the modal -->
            <button class="btn bg-red-600 text-white" on:click={()=>{takeConnect()}} >Take</button>
            <button on:click={()=>{clearConnect()}} class="btn" >Clear All</button>
            <button class="btn">Close</button>
          </form>
        </div>
      </div>
    </dialog>