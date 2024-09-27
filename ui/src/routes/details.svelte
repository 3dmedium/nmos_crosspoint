<script lang="ts">
    import ServerConnector from "../lib/ServerConnector/ServerConnectorService"
    import type { Subject } from "rxjs";
    import { onDestroy, onMount } from "svelte";

    import { Icon, MagnifyingGlass, RectangleGroup, Cog, Pencil, ChevronRight,
       VideoCamera, Microphone, SpeakerWave, Tv,
       ArrowRightStartOnRectangle, ArrowLeftEndOnRectangle,
       CodeBracketSquare,
       BarsArrowDown, BarsArrowUp, ArrowUturnLeft, CodeBracket
     } from "svelte-hero-icons";
    import SetupFlow from "../lib/SetupFlow.svelte";
    import SetupDevice from "../lib/SetupDevice.svelte";

    import ScrollArea from "../lib/ScrollArea.svelte";
    import { getSearchTokens, tokenSearch } from "../lib/functions";
    import OverlayMenuService from "../lib/OverlayMenu/OverlayMenuService";


    let tableCols = [
        
        {id:"num", name:"#" ,          sortable:true,  resize:false, fixed:true, fixedOffset:56, width:100 },
        {id:"available", name:"" ,     sortable:true,  resize:false, fixed:true, fixedOffset:156, width:60 },
        {id:"type", name:"Type" ,      sortable:false, resize:false, fixed:true, fixedOffset:216, width:60   },
        {id:"name", name:"Name" ,      sortable:true, resize:false,  fixed:true, fixedOffset:276 },
        
        {id:"codec", name:"Codec" ,    sortable:false, resize:true  },
        {id:"format", name:"Format" ,  sortable:false, resize:true  },
        {id:"bitrate", name:"Bitrate", sortable:false, resize:true  },
        {id:"sync", name:"Sync" ,      sortable:false, resize:true  },
        {id:"flow", name:"Settings" ,  sortable:false, resize:true  },
        {id:"info", name:"Info" ,      sortable:false, resize:true  },
    ]

    let mediaTypes = {
      "video/raw" : "RAW Video",
      "video/jxsv" : "JPEG-XS Video",
      "video/colibri" : "Colibri Video",
      "audio/L16" : "16 Bit LPCM",
      "audio/L24" : "24 Bit LPCM",
      "audio/AM824" : "ST2110-31 AES3",
      "video/smpte291":"ANC"
    }

    let searchExpandedDevices:string[] = [];

    let filter:any = {
      version:"11133",
      expanded: { devices :[]},
      hiddenCols:[],
      widthCols:{},
      sortCols:[],
      search:"",
      searchFormat:"",
      searchIp:"",
      hiddenTypes:[],
      showRx:true,
      showTx:true


    };

    let sourceState:any = {};
    let list:any = [];

    let nmosState:any = {
        devices: {},
        sources: {},
        senders: {},
        receivers: {},
        flows: {},
        nodes: {},
        sendersManifestDetail :{}
    };

    let sync:Subject<any> ;
    let syncNmos:Subject<any> ;

      function reRender(){
        list = [...list];
      }

    onMount(async () => {
      sync = ServerConnector.sync("crosspoint")
          sync.subscribe((obj:any)=>{
            sourceState = obj;
             doFilter();
      });
      syncNmos = ServerConnector.sync("nmos")
      syncNmos.subscribe((obj:any)=>{
            nmosState = obj;
            reRender();
      });
      try{
        let f = localStorage.getItem("nmos_details_filter");
        if(f){
          let tempFilter = JSON.parse(f);
          if(tempFilter.version == filter.version){
            filter = tempFilter;
          }else{
            console.log("Resetting detail filter localstorage.");
            saveFilter();
          }
        }
      }catch(e){}
    });
    onDestroy(() => {
      sync.unsubscribe();
          ServerConnector.unsync("crosspoint")
      syncNmos.unsubscribe();
          ServerConnector.unsync("nmos")
    });

      function saveFilter(){
      localStorage.setItem("nmos_details_filter", JSON.stringify(filter));
    }

    let countAvailable = 0;
    let countUnavailable = 0;
    let countTotal = 0;
    function doFilter(){
        // TODO Filtering
        countAvailable = 0;
        countUnavailable = 0;
        countTotal = 0;
        searchExpandedDevices = [];

        sourceState.devices.forEach((d)=>{
          if(d.available){
            countAvailable ++
          }else{
            countUnavailable ++
          }
          countTotal ++
        })
        list =  structuredClone(sourceState.devices);

        if(filter.search != "" || filter.searchFormat != "" || filter.searchIp != "" ){

          let searchTokens = getSearchTokens(filter.search);
          let formatTokens = getSearchTokens(filter.searchFormat);
          let ipTokens = getSearchTokens(filter.searchIp);
          
          list = list.filter((dev:any)=>{
            let flowFound = false;
            let devFound = false;
            if(formatTokens.length == 0 && ipTokens.length == 0){
              devFound = tokenSearch(dev, searchTokens, ["alias","name"]);
            }
            for(let type in dev.senders){
              
              // TODO mybe add original Name to search fields?
              

              dev.senders[type] = dev.senders[type].filter((send:any)=>{

                let settings = getSenderSettings(send);
                let ipSettings = "";
                settings.forEach((s)=>{
                  ipSettings += s.dstIp + " ";
                  ipSettings += s.srcIp + " ";
                });
                if(ipSettings == ""){
                  ipSettings="__noIP__"
                }
                
                let ipFound = true;
                let format = true;
                let found = true;
                if(ipTokens.length != 0){
                  ipFound = tokenSearch(ipSettings, ipTokens);
                }
                if(searchTokens.length != 0){
                  found = tokenSearch(send, searchTokens, ["alias","name"]);
                }
                if(formatTokens.length != 0){
                  format = tokenSearch(send, formatTokens, ["format"]);
                }
                if( found && format && ipFound){
                  flowFound = true;
                }
                return (found || devFound) && format && ipFound;
              });

              dev.receivers[type] = dev.receivers[type].filter((recv:any)=>{
                
                let found = tokenSearch(recv, searchTokens, ["alias","name"]);
                let format = tokenSearch(recv, formatTokens, ["format"]);
                if(ipTokens.length != 0){
                  found = false; 
                  format = false;
                }
                if(found && format){
                  flowFound = true;
                }
                return (found || devFound) && format;
              });
            }

            if(devFound){
              return true;
            }
              
            if(flowFound){
              searchExpandedDevices.push(dev.id);
              return true;
            }
            
            return false
          })
        }
        
    }

    function toggleExpandDevice(id:string){
      let index = searchExpandedDevices.indexOf(id);
      if(index == -1){

        let saveindex = filter.expanded.devices.indexOf(id);
      if(saveindex == -1){
        filter.expanded.devices.push(id);
      }else{
        filter.expanded.devices.splice(saveindex,1);
      }
      saveFilter();
        
      }else{
        searchExpandedDevices.splice(index,1);
      }
      
      
      list = [...list]
    }
    function isDeviceExpanded(id:string){
      if(searchExpandedDevices.includes(id)){
        return true;
      }
      if(filter.expanded.devices.includes(id)){
        return true;
      }
      return false;
    }


    function renderId(id:string){
        if(id.startsWith("nmos_")){
          let nmosId = id.substring(5);
          let nmosVersion ="";
          if(nmosState.senders && nmosState.senders[nmosId]){
            nmosVersion = nmosState.senders[nmosId]._sourceVersion
          }
          if(nmosState.receivers && nmosState.receivers[nmosId]){
            nmosVersion = nmosState.receivers[nmosId]._sourceVersion
          }
          if(nmosState.devices && nmosState.devices[nmosId]){
            nmosVersion = nmosState.devices[nmosId]._sourceVersion
          }
          return "NMOS " +nmosVersion + " " + nmosId;
        }
        return id;
      }

      function renderFlowNum( flow:any){
        let num = "";
        switch(flow.type){
          case "video":
            num += "v";
            break;
          case "audio":
            num += "a";
            break;
          case "data":
            num += "d";
            break;
            default:
              num+="u";

        }
        num += flow.num;
        return num;
      }


      function getSync(sender:any){
        let sync = {
          available:false,
          source:"",
          ptpdomain:0
        };
        if(sender.id.startsWith("nmos_")){
          let nmosSenderId = sender.id.substring(5);
          // TODO data from Manifest??????
          //console.log(nmosState)
          //console.log(nmosState.sendersManifestDetail[nmosSenderId])
          //console.log(nmosState.sendersManifestDetail[nmosSenderId])
          try{
            if(nmosState.sendersManifestDetail[nmosSenderId].media[0].tsRefClocks[0].clksrc == "ptp"){
              let s = nmosState.sendersManifestDetail[nmosSenderId].media[0].tsRefClocks[0].clksrcExt.split(":");
              sync.source = s[1];
              sync.ptpdomain = s[2];
              sync.available = true;
            }
          }catch(e:any){
            //console.log(e)
          }
        }
          return sync;
      }


      function getSenderSettings(sender:any){
        let mediaStrams:any[] = [];

        if(sender.id.startsWith("nmos_")){
          let nmosSenderId = sender.id.substring(5);
          // TODO data from Manifest??????
          //console.log(nmosState)
          //console.log(nmosState.sendersManifestDetail[nmosSenderId])
          //console.log(nmosState.sendersManifestDetail[nmosSenderId])
          try{
            nmosState.sendersManifestDetail[nmosSenderId].media.forEach((media:any)=>{
              let m = {
                srcIp : media.sourceFilter.srcList,
                dstIp : media.sourceFilter.destAddress,
                name: media.mid
              }
              mediaStrams.push(m);
            })
          }catch(e:any){
            //console.log(e)
          }
          

          


        }

        return mediaStrams;
        
      }

      function renderBitrate(bitrate:number){
        bitrate = Math.round(bitrate*1000)/1000
        if(bitrate <= 1){
          return "< 1 MBit/s"
        }
        return bitrate + " MBit/s"
      }


      function renderCodecs(list:string[]){
        let codec:string[] = [];
        list.forEach((c)=>{
          if(mediaTypes.hasOwnProperty(c)){
            codec.push((mediaTypes as any)[c]);
          }else{
            codec.push(c);
          }
        });
        return codec.join(", ");
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
        labelModalInput.select();
      }
      function changeLabelSend(){
        ServerConnector.post("changealias",{id:labelModalId, alias:labelModalValue})
        labelModal.close()
      }
      

      let editorModal;
      let activeEditorId:string = "";
      let activeEditorType:string = "";
      function openFlowEditor(flowId:string){
        activeEditorId = flowId;
        activeEditorType = "flow";
        editorModal.showModal();
      }

      function openDeviceEditor(deviceId:string){
        activeEditorId = deviceId;
        activeEditorType = "device";
        editorModal.showModal();
      }

      let filterTimeouet:any = null;
      function changeFilter(immediate=false){
        if(immediate){
          if(filterTimeouet){
            clearTimeout(filterTimeouet);
          }
          doFilter();
          saveFilter();
          return;
        }
        if(filterTimeouet){
          clearTimeout(filterTimeouet);
          filterTimeouet = null;
        }
        filterTimeouet = setTimeout(()=>{
          doFilter();
          saveFilter();
        },200);
      }


      function toggelHiddenCol(id:string = ""){
        if(id == ""){
          filter.hiddenCols = [];
          return;
        }
        if(filter.hiddenCols.includes(id)){
          filter.hiddenCols = filter.hiddenCols.filter((c)=>{
            if(c == id){
              return false
            }
            return true
          })
        }else{
          filter.hiddenCols.push(id);
        }
        filter = {...filter}
        saveFilter()
      }

      let resizeDragPos = 0;
      let resizeDragStartWidth = 0;


      function startResizeDrag(e:MouseEvent, id:string){
        resizeDragPos = e.x;

        if(!filter.widthCols.hasOwnProperty(id)){
          filter.widthCols[id] = 0
        }
        resizeDragStartWidth = filter.widthCols[id];
      }

      function updateResizeDrag(e:MouseEvent, id:string){
        if(e.x != 0){
          filter.widthCols[id] = (e.x - resizeDragPos) + resizeDragStartWidth
        }
          

      }

      function endResizeDrag(e:MouseEvent, id:string){
        saveFilter();
        
      }

      function toggleSort(id:string){
        if(filter.sortCols.includes(id+"__down")){
          filter.sortCols = filter.sortCols.filter((e:string)=>{
            if(e == id+"__down"){
              return false
            }
            return true
          })
          filter.sortCols.unshift(id+"__up")

        }else if(filter.sortCols.includes(id+"__up")){
          filter.sortCols = filter.sortCols.filter((e:string)=>{
            if(e == id+"__up"){
              return false
            }
            return true
          })
        }else{
          filter.sortCols.unshift(id+"__down")
        }
        doFilter();
        saveFilter();
      }


  </script>
  

  <div class="content-container">


    <ul class="menu bg-base-200 menu-horizontal rounded-box filter-nav">
      <li>
        <label class="input input-ghost flex gap-2">
          <input bind:value={filter.search} on:input={()=>changeFilter()} type="text" class="grow" placeholder="Search Names" />
          <Icon src={MagnifyingGlass}></Icon>
        </label>
      </li>
      <li>
        <label class="input input-ghost flex gap-2">
          <input bind:value={filter.searchFormat} on:input={()=>changeFilter()} type="text" class="grow" placeholder="Search Format" />
          <Icon src={RectangleGroup}></Icon>
        </label>
      </li>

      <li>
        <label class="input input-ghost flex gap-2">
          <input bind:value={filter.searchIp} on:input={()=>changeFilter()} type="text" class="grow" placeholder="Search IP" />
          <Icon src={RectangleGroup}></Icon>
        </label>
      </li>

      <li>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">RX</span> 
          <input on:input={()=>changeFilter()} bind:checked={filter.showRx} type="checkbox" class="toggle" />
        </label>
      </li>
      <li>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">TX</span> 
          <input on:input={()=>changeFilter()} bind:checked={filter.showTx} type="checkbox" class="toggle" />
        </label>
      </li>

      <li class="nav-spacer"></li>
      <li style="flex-wrap:nowrap; flex-direction:row;">
        <span class="text-info " use:OverlayMenuService.tooltip data-tooltip="Total">{countTotal}</span><span>/</span>
        <span class="text-success " use:OverlayMenuService.tooltip data-tooltip="Available">{countAvailable}</span><span>/</span>
        <span class="text-error" use:OverlayMenuService.tooltip data-tooltip="Unavailable">{countUnavailable}</span>
      </li>
    </ul>

    
    <ScrollArea autoHide={false}>
  <table class="data-table">

    <thead>
        <tr>
          <td class="data-table-fixed-col" style="min-width:56px;"></td>
            {#each tableCols as col}
                {#if !filter.hiddenCols.includes(col.id)}
                    <td class="{(col.fixed ? "data-table-fixed-col":"")}" style="{ filter.widthCols.hasOwnProperty(col.id) ? "min-width:"+filter.widthCols[col.id]+"px;":""} {col.fixedOffset ? "left:"+col.fixedOffset+"px;":""} {col.width ? "min-width:"+col.width+"px;":""}">
                      <div class="table-cell">
                        <div class="table-content">{col.name}</div>
                        <div class="table-functions">
                      {#if col.sortable}
                      {#if filter.sortCols.includes(col.id + "__down")}
                        <button class="btn btn-circle btn-ghost" on:click={()=>{toggleSort(col.id)}}>
                          <Icon class="text-info" src={BarsArrowDown}></Icon>
                        </button>
                      {:else if filter.sortCols.includes(col.id + "__up")}
                        <button class="btn btn-circle btn-ghost" on:click={()=>{toggleSort(col.id)}}>
                          <Icon class="text-info" src={BarsArrowUp}></Icon>
                        </button>
                      {:else}
                      <button class="btn btn-circle btn-ghost" on:click={()=>{toggleSort(col.id)}}>
                        <Icon class="" src={BarsArrowDown}></Icon>
                      </button>
                      {/if}
                      {/if}

                        </div>
                      </div>
                      {#if col.resize}
                        <div class="resize-handler" draggable={true}
                          on:dragstart={(e)=>{startResizeDrag(e,col.id)}}
                          on:drag={(e)=>{updateResizeDrag(e,col.id)}}
                          on:dragend={(e)=>{endResizeDrag(e,col.id)}}
                        ></div>
                      {/if}
                    </td>
                {/if}
            {/each}
            <td> Settings</td>
        </tr>
    </thead>
    <tbody>
        {#each list as dev}
            <tr on:dblclick={()=>{toggleExpandDevice(dev.id)}} class={"det-device"}>
                <td on:click={()=>{toggleExpandDevice(dev.id)}} class="data-table-fixed-col" style="min-width:56px;"><span class={"data-table-expand "+ (isDeviceExpanded(dev.id) ? "data-table-expand-active":"")}><Icon src={ChevronRight}></Icon></span></td>
                {#each tableCols as col}
                    {#if !filter.hiddenCols.includes(col.id)}
                    <td class="{(col.fixed ? "data-table-fixed-col":"")}" style="{col.fixedOffset ? "left:"+col.fixedOffset+"px;":""} {col.width ? "min-width:"+col.width+"px;":""}">

                            {#if col.id == "num"}
                            <span>{dev.num}</span>
                            {/if}

                            {#if col.id == "available"}
                            <div class="badge badge-{ dev.available ? "success" : "error"} badge-sm"></div>
                            {/if}

                            {#if col.id == "name"}
                                    {#if dev.name == dev.alias}
                                      <span>{dev.alias}</span>
                                    {:else}
                                      <span data-tooltip-position="center,bottom" use:OverlayMenuService.tooltip data-tooltip="{dev.name}">{dev.alias}</span>
                                    {/if}
                                    <button on:click={()=>{openLabelEditor(dev.id,dev.name,dev.alias)}} class="btn btn-round btn-hover">
                                      <Icon src={Pencil}></Icon>
                                    </button>
                                    {/if}

                            {#if col.id == "info"}
                            {renderId(dev.id)}
                            {/if}

                        </td>
                    {/if}
                {/each}
                <td>
                  <button class="btn btn-circle" on:click={()=>{openDeviceEditor(dev.id)}}>
                    <Icon src={Cog}></Icon>
                  </button>
                </td>
            </tr>
            {#if isDeviceExpanded(dev.id)}
              {#if filter.showTx }
                {#each [...dev.senders.video, ...dev.senders.audio, ...dev.senders.data]  as flow}
                    <tr class={"data-table-expanded det-flow det-flow-tx det-flow-"+flow.type}>
                        <td class="data-table-fixed-col"></td>
                        {#each tableCols as col}
                            {#if !filter.hiddenCols.includes(col.id)}
                                <td class="{(col.fixed ? "data-table-fixed-col":"")}" style="{col.fixedOffset ? "left:"+col.fixedOffset+"px;":""} {col.width ? "min-width:"+col.width+"px;":""}">

                                    {#if col.id == "num"}
                                    &nbsp;&nbsp;&nbsp;{dev.num + "." + renderFlowNum(flow) }
                                    {/if}

                                    {#if col.id == "available"}
                                    <div class="badge badge-{ flow.available ? (flow.manifestOk ? "success" : "warning") : "error"} badge-sm"></div>
                                    {/if}

                                    {#if col.id == "name"}
                                    {#if flow.name == flow.alias}
                                      <span>{flow.alias}</span>
                                    {:else}
                                      <span data-tooltip-position="center,bottom" use:OverlayMenuService.tooltip data-tooltip="{flow.name}">{flow.alias}</span>
                                    {/if}
                                    <button on:click={()=>{openLabelEditor(flow.id,flow.name,flow.alias)}} class="btn btn-round btn-hover">
                                      <Icon src={Pencil}></Icon>
                                    </button>
                                    {/if}

                                    {#if col.id == "codec"}
                                    {renderCodecs(flow.capabilities.mediaTypes)}
                                    {/if}


                                    {#if col.id == "format"}
                                    {flow.format}
                                    {/if}

                                    {#if col.id == "bitrate"}
                                    <span>Est.: {renderBitrate(flow.bitrate)}</span>
                                    
                                    {/if}

                                    {#if col.id == "type"}
                                    {#if flow.type == "video"}
                                    <span class="icon-large-video"><Icon src={VideoCamera}></Icon></span>
                                      {:else if flow.type == "audio"}
                                      <span class="icon-large-audio"><Icon src={Microphone}></Icon></span>
                                      {:else}
                                      <span class="icon-large-data"><Icon src={ArrowRightStartOnRectangle}></Icon></span>
                                      {/if}
                                      TX 
                                      {flow.type == "data" ? "Anc":"" }
                                    {/if}

                                    {#if col.id == "info"}
                                      <span>
                                        {renderId(flow.id)}
                                      </span>
                                      {#if !flow.manifestOk}
                                        <span class="text-error">No Manifest Loaded</span>
                                      {/if}
                                    {/if}

                                    {#if col.id == "sync"}
                                      {#each [getSync(flow)] as sync}
                                      {#if sync.available}
                                        <span>Source: {sync.source}</span>
                                        <span>Domain: {sync.ptpdomain}</span>
                                      {/if}
                                      {/each}
                                    {/if}


                                    {#if col.id == "flow"}
                                      {#each getSenderSettings(flow) as settings}
                                        <div>
                                          <!--<span>{settings.name} : </span>-->
                                          <span>Dst: {settings.dstIp} Src: {settings.srcIp}</span>
                                        </div>
                                      {/each}
                                    {/if}

                                </td>
                            {/if}
                        {/each}
                        <td>
                          <button class="btn btn-circle" on:click={()=>{openFlowEditor(flow.id)}}>
                            <Icon src={Cog}></Icon>
                          </button>
                        </td>
                    </tr>
                {/each}
              {/if}
              {#if filter.showRx }
                {#each [...dev.receivers.video, ...dev.receivers.audio, ...dev.receivers.data] as flow}
                  <tr class={"data-table-expanded det-flow det-flow-rx det-flow-"+flow.type}>
                    <td class="data-table-fixed-col"></td>
                        {#each tableCols as col}
                            {#if !filter.hiddenCols.includes(col.id)}
                            <td class="{(col.fixed ? "data-table-fixed-col":"")}" style="{col.fixedOffset ? "left:"+col.fixedOffset+"px;":""} {col.width ? "min-width:"+col.width+"px;":""}">

                                    {#if col.id == "num"}
                                    &nbsp;&nbsp;&nbsp;{dev.num + "." + renderFlowNum(flow) }
                                    {/if}

                                    {#if col.id == "available_flow"}
                                    <div class="badge badge-{ flow.available ? "success" : "error"} badge-sm"></div>
                                    {/if}


                                    {#if col.id == "name"}
                                    {#if flow.name == flow.alias}
                                      <span>{flow.alias}</span>
                                    {:else}
                                      <span data-tooltip-position="center,bottom" use:OverlayMenuService.tooltip data-tooltip="{flow.name}">{flow.alias}</span>
                                    {/if}
                                    <button on:click={()=>{openLabelEditor(flow.id,flow.name,flow.alias)}} class="btn btn-round btn-hover">
                                      <Icon src={Pencil}></Icon>
                                    </button>
                                    {/if}

                                    {#if col.id == "codec"}
                                    {renderCodecs(flow.capabilities.mediaTypes)}
                                    {/if}

                                    {#if col.id == "type"}
                                    {#if flow.type == "video"}
                                    <span class="icon-large-video"><Icon src={Tv}></Icon></span>
                                      {:else if flow.type == "audio"}
                                      <span class="icon-large-audio"><Icon src={SpeakerWave}></Icon></span>
                                      {:else}
                                      <span class="icon-large-data"><Icon src={ArrowLeftEndOnRectangle}></Icon></span>
                                      {/if}
                                      RX
                                      {flow.type == "data" ? "Anc":"" }
                                    {/if}

                                    {#if col.id == "info"}
                                    {renderId(flow.id)}
                                    {/if}

                                </td>
                            {/if}
                        {/each}
                        <td>
                          <button class="btn btn-circle">
                            <Icon src={Pencil}></Icon>
                          </button>
                        </td>
                    </tr>
                  {/each}
                {/if}
            {/if}
        {/each}
    </tbody>

  </table>
</ScrollArea>

    
  </div>

  <dialog bind:this={editorModal} class="modal">
    <div class="modal-box">
      {#if activeEditorType == "flow"}
      <SetupFlow flowId={activeEditorId}></SetupFlow>
      {/if}

      {#if activeEditorType == "device"}
      <SetupDevice deviceId={activeEditorId}></SetupDevice>
      {/if}

      <div class="modal-action">
      </div>
    </div>
  </dialog>


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
  