<script lang="ts">
    import ServerConnector from "../../lib/ServerConnector/ServerConnectorService";
    import type { Subject } from "rxjs";
    import { onDestroy, onMount } from "svelte";

    import { Icon, MagnifyingGlass, EllipsisVertical, RectangleGroup,ArrowPath, Cog, Pencil, ChevronRight, VideoCamera, Microphone, CodeBracketSquare, 
      BarsArrowDown,
      BarsArrowUp, 
      ArrowUturnLeft,
      CodeBracket
    } from "svelte-hero-icons";
    import SetupFlow from "../../lib/SetupFlow.svelte";
    import SetupDevice from "../../lib/SetupDevice.svelte";
    import OverlayMenuService from "../../lib/OverlayMenu/OverlayMenuService";
    import ScrollArea from "../../lib/ScrollArea.svelte";
    import { getSearchTokens, tokenSearch } from "../../lib/functions";


    let tableCols = [

        {id:"state", name:"", sortable:true,sortField:"__customState",  resize:false , canHide:false, fixed:true},
        {id:"name", name:"Name" ,     sortable:true,sortField:"name",  resize:true  , canHide:false, fixed:true, fixedOffset:40},

        {id:"sn", name:"# SN" ,          sortable:true,sortField:"sn",  resize:false , canHide:false},
        {id:"fwversion", name:"Firmware" ,     sortable:true,sortField:"firmwareVersion",  resize:false  , canHide:true},
        {id:"fwmode", name:"Mode" ,     sortable:true,sortField:"simpleMode",  resize:false  , canHide:true},
        {id:"type", name:"Type" ,     sortable:true,sortField:"type",  resize:false  , canHide:true},
        {id:"ip", name:"IP Address" ,     sortable:true, sortField:"__customIpList", resize:true  , canHide:false},
        
        {id:"network", name:"Network" ,     sortable:true, sortField:"__customNetwork", resize:true  , canHide:true},
        
        {id:"temperature", name:"Temperature" ,     sortable:false, resize:false  , canHide:true},
        
        {id:"frontpanelLock", name:"Buttons Locked" ,     sortable:false, resize:false  , canHide:true},
        {id:"hdcpEnabled", name:"HDCP Enabled" ,     sortable:false, resize:false  , canHide:true},
        {id:"jpegxsLicensed", name:"JPEG XS License" ,     sortable:false, resize:false  , canHide:true},

        {id:"ptpStatus", name:"PTP Status" ,     sortable:true, sortField:"ptpStatus", resize:false  , canHide:true},
        {id:"ptpDomain", name:"PTP Domain" ,     sortable:true, sortField:"__customPtpDomain", resize:false  , canHide:true},
        {id:"flowMode", name:"Flow Mode" ,     sortable:true, sortField:"flowMode", resize:false  , canHide:true},

        
        {id:"masterEnabled", name:"Master Enable" ,     sortable:true, sortField:"masterEnabled",  resize:false  , canHide:true},
        {id:"masterEnabledMenu", name:"" ,     sortable:false,  resize:false  , canHide:false},


        {id:"inputResolution", name:"Input" ,     sortable:false,  resize:false  , canHide:true},
        {id:"scalerMode", name:"Scaler" ,     sortable:false,  resize:false  , canHide:true},
        {id:"outputResolution", name:"Output" ,     sortable:false,  resize:false  , canHide:true},
        {id:"scalerModeMenu", name:"" ,     sortable:false,  resize:false  , canHide:true},
        
        {id:"audioFormat", name:"Audio Format" ,     sortable:false,  resize:false  , canHide:true},
        
        {id:"edidMonitor", name:"Monitor EDID" ,     sortable:false,  resize:false  , canHide:true},
        {id:"edidNativeResMonitor", name:"Monitor Native Resolution" ,     sortable:false,  resize:true  , canHide:true},

        {id:"edidInput", name:"Input EDID" ,     sortable:false,  resize:false  , canHide:true},
        {id:"edidNativeResInput", name:"Input Native Resolution" ,     sortable:false,  resize:false  , canHide:true},
        {id:"edidModeMenu", name:"" ,     sortable:false,  resize:false  , canHide:true},
    ]

    

    

    let filter:any = {
      version:"112369",
      hiddenCols:[],
      widthCols:{},
      sortCols:[],
      search:"",
      searchIp:"",
      batchJob:"",
      batchJobReboot:false,
    };


    

    let sourceState:any = {devices:{},settings:{edids:[],resolutions:[],ptpDomain:127},quickState:{
        label:"Matrox Convert IP",
        name:"matroxcip",
        count:0,
        error:0,
        detail: [
            {label:"Connected", color: "success", count:0 },
            {label:"Session Conflict", color: "warning", count:0 },
            {label:"Unreachable", color: "error", count:0 },
        ],
        note:""
    }};
    let list:any = [];

    let menu = OverlayMenuService;

    let sync:Subject<any> ;


    onMount(async () => {
        sync = ServerConnector.sync("mediadevmatroxcip")
        sync.subscribe((obj:any)=>{
            sourceState = obj;
             doFilter();
        });
      try{
        let f = localStorage.getItem("mediadevmatroxcip_filter");
        if(f){
          let tempFilter = JSON.parse(f);
          if(tempFilter.version == filter.version){
            filter = tempFilter;
          }else{
            console.log("Resetting mediadevmatroxcip filter localstorage.");
            saveFilter();
          }
        }
      }catch(e){}
    });
    onDestroy(() => {
      sync.unsubscribe();
          ServerConnector.unsync("mediadevmatroxcip")
    });

      function saveFilter(){
      localStorage.setItem("mediadevmatroxcip_filter", JSON.stringify(filter));
    }

    function doFilter(){
        // TODO Filtering
        list = [];
        for(let cip in sourceState.devices){
            list.push(structuredClone(sourceState.devices[cip]))
        }
        if(filter.search != ""){
          let searchTokens = getSearchTokens(filter.search);    
          list = list.filter((cip:any)=>{
            return tokenSearch(cip, searchTokens, ["name","sn"]);
          });
        }

        if(filter.searchIp != ""){
          let searchTokens = getSearchTokens(filter.searchIp);    
          list = list.filter((cip:any)=>{
            return tokenSearch(cip.ipList.join(""), searchTokens );
          });
          filter = {...filter};
        }

        list.sort((a:any, b:any) =>{
          for(let col of filter.sortCols){
            // Custom sorter

            let t = col.split("__")
            let colId = t[0];
            let direction = t[1];
            let sortField:string|undefined = ""
            tableCols.forEach((c)=>{
              if(c.id == colId){
                sortField = c.sortField
              }
            })
            
            if(sortField){


              if(sortField == "__customState"){
                let at = ( (a.failed  || a.sessionConflict ) ? true:false);
                let bt = ( (b.failed  || b.sessionConflict ) ? true:false);
                //console.log(a.failed,a.sessionConflict,at,b.failed,b.sessionConflict,bt)
                if(at == bt){
                  // use next
                }else{
                  if(direction == "down"){
                    if(at == true && bt == false){
                      return 1;
                    }else{
                      return -1;
                      
                    }
                  }else{
                    if(at == true && bt == false){
                      return -1;
                    }else{
                      return 1;
                    }
                  }
                  
                }
              }else if(sortField == "__customPtpDomain"){
                if(a['ptpDomain'] == b['ptpDomain']){
                  // use next
                }else{
                  if(direction == "down"){
                    return (a['ptpDomain'] < b['ptpDomain'] ? 1:-1);
                  }else{
                    return (a['ptpDomain'] > b['ptpDomain'] ? 1:-1);
                  }
                  
                }
              }else if(sortField == "__customNetwork"){
                let ac = 0;
                let bc = 0;

                a.linkStatus.forEach((l:any)=>{
                  if(l.up){
                    ac++;
                  }
                })
                b.linkStatus.forEach((l:any)=>{
                  if(l.up){
                    bc++;
                  }
                })
                
                if(ac === bc){
                  // use next
                }else{
                  if(direction == "down"){
                    return (ac < bc ? 1:-1);
                  }else{
                    return (ac > bc ? 1:-1);
                  }
                  
                }
              }else if(sortField == "__customIpList"){
                let comp = (a["ipList"][0] as string).localeCompare(b["ipList"][0],undefined, { sensitivity: 'accent' });
                if(comp === 0){
                  // use next
                }else{
                  if(direction == "down"){
                    return comp;
                  }else{
                    return comp * -1;
                  }
                  
                }
              }else{
                if(typeof a[sortField] === "string"){
                  let comp = (a[sortField] as string).localeCompare(b[sortField],undefined, { sensitivity: 'accent' });
                  if(comp === 0){
                    // use next
                  }else{
                    if(direction == "down"){
                      return comp;
                    }else{
                      return comp * -1;
                    }
                    
                  }
                }else if(typeof a[sortField] === "boolean"){
                  
                  if(a[sortField] == b[sortField]){
                    // use next
                  }else{
                    if(direction == "down"){
                      if(a[sortField] == true){
                        return 1;
                      }else{
                        return -1;
                        
                      }
                    }else{
                      if(a[sortField] == true){
                        return -1;
                      }else{
                        return 1;
                      }
                    }
                    
                  }
                    
                  }else if(typeof a[sortField] === "number"){
                    if(a[sortField] == b[sortField]){
                      // use next
                    }else{
                      if(direction == "down"){
                        return (a[sortField] < b[sortField] ? 1:-1);
                      }else{
                        return (a[sortField] > b[sortField] ? 1:-1);
                      }
                      
                    }  
                  }else{
                    // Ignore and do next
                  }
              }
            }
          }

          return 0;
        });

        // TODO Bug with Sort Cols not icon color updating on multiple changes
    }



    function batchJob(sn:string){
      ServerConnector.startLoad();
        ServerConnector.post("matroxcip_batchjob",{sn:sn, context:filter.batchJob, reboot:filter.batchJobReboot}).then((f:any)=>{
        ServerConnector.endLoad();
        ServerConnector.addFeedback({level:"success",message:"Command done"})
        }).catch((e)=>{
          ServerConnector.endLoad();
          ServerConnector.addFeedback({level:"error",message:"Command Failed: "+ e.message})
        });
    }


   
     function forceReload(sn:string){
        ServerConnector.get("matroxcip_forcereload/"+sn).then((f:any)=>{
        }).catch((e)=>{
        });
     }
     function forceReloadAll(){
        ServerConnector.get("matroxcip_forcereloadall").then((f:any)=>{
        }).catch((e)=>{
        });
     }

    function fixPtpDomain(sn:string){
      ServerConnector.startLoad();
        ServerConnector.post("matroxcip_fixptpdomain",{sn:sn}).then((f:any)=>{
        ServerConnector.endLoad();
        ServerConnector.addFeedback({level:"success",message:"PTP changed"})
        }).catch((e)=>{
          ServerConnector.endLoad();
          ServerConnector.addFeedback({level:"error",message:"Can not change PTP: "+ e.message})
        });
    }


     function changeEdid(sn:string, name:string){
      ServerConnector.startLoad();
        ServerConnector.post("matroxcip_changeedid",{sn:sn, name:name}).then((f:any)=>{
        ServerConnector.endLoad();
        ServerConnector.addFeedback({level:"success",message:"EDID changed"})
        }).catch((e)=>{
          ServerConnector.endLoad();
          ServerConnector.addFeedback({level:"error",message:"Can not change EDID: "+ e.message})
        });
     }

     function enableMaster(sn:string){
      ServerConnector.startLoad();
      ServerConnector.post("matroxcip_enablemaster",{sn:sn}).then((f:any)=>{
        ServerConnector.endLoad();
        ServerConnector.addFeedback({level:"success",message:"Master enabled"})
        }).catch((e)=>{
          ServerConnector.endLoad();
          ServerConnector.addFeedback({level:"error",message:"Can not enable master: "+ e.message})
        });
     }

     function changeResolution(sn:string, name:string){
        ServerConnector.startLoad();
        ServerConnector.post("matroxcip_changeresolution",{sn:sn, name:name}).then((f:any)=>{
        ServerConnector.endLoad();
        ServerConnector.addFeedback({level:"success",message:"Resolution changed"})
        }).catch((e)=>{
          ServerConnector.endLoad();
          ServerConnector.addFeedback({level:"error",message:"Can not change resolution: "+ e.message})
        });
     }

     
     function getMenuTxScalerMode(dev:any){
        let data:any = {entry:[]}
        for(let res of sourceState.settings.resolutions){
          data.entry.push({label:"Force Resolution: "+res.name,callback:()=>{changeResolution(dev.sn,res.name)}})
      }
      data.entry.push({label:"No Scaling",callback:()=>{changeResolution(dev.sn,"__input")}})
      return data
     }
     function getMenuRxScalerMode(dev:any){
        let data:any = {entry:[]}
        for(let res of sourceState.settings.resolutions){
          data.entry.push({label:"Force Resolution: "+res.name,callback:()=>{changeResolution(dev.sn,res.name)}})
      }
      data.entry.push({label:"Scale to EDID",callback:()=>{changeResolution(dev.sn,"__edid")}})
      data.entry.push({label:"Auto",callback:()=>{changeResolution(dev.sn,"__input")}})
      return data
     }
      
     function getMenuInputEdid(dev:any){
        let data:any = {entry:[]}
        for(let res of sourceState.settings.edids){
          data.entry.push({label:"Use EDID: "+res.name,callback:()=>{changeEdid(dev.sn,res.name)}})
      }
      data.entry.push({label:"Use Native EDID",callback:()=>{changeEdid(dev.sn,"__nativeMatrox")}})
      data.entry.push({label:"Passthrough EDID",callback:()=>{changeEdid(dev.sn,"__passthrough")}})
      return data
     }

      

     let tableModal:any;
     let batchModal:any;

      let batchActive = false;

      let editorModal;
      let activeEditorId:string = "";
      let activeEditorType:string = "";
      
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
          <input bind:value={filter.searchIp} on:input={()=>changeFilter()} type="text" class="grow" placeholder="Search IP" />
          <Icon src={MagnifyingGlass}></Icon>
        </label>
      </li>
      <li class="nav-spacer"></li>
      <li style="flex-wrap:nowrap; flex-direction:row;">
        <span class="text-success " use:OverlayMenuService.tooltip data-tooltip="Connected">{sourceState.quickState.detail[0].count}</span><span>/</span>
        <span class="text-error" use:OverlayMenuService.tooltip data-tooltip="Errors ({sourceState.quickState.detail[1].count} Session Conflicts)">{sourceState.quickState.error}</span><span>/</span>
        <span class="text-info" use:OverlayMenuService.tooltip data-tooltip="Total">{sourceState.quickState.count}</span>
      </li>
      <li class="nav-spacer"></li>
      <li>
        <button class="btn-nav" data-tooltip-position="left,bottom" use:OverlayMenuService.tooltip data-tooltip="Bacth Jobs" on:click={()=>batchModal.showModal()}><Icon src={CodeBracket}></Icon></button>
      </li>
      <li>
        <button class="btn-nav" data-tooltip-position="left,bottom" use:OverlayMenuService.tooltip data-tooltip="Show or Hide Cols." on:click={()=>tableModal.showModal()}><Icon src={EllipsisVertical}></Icon></button>
      </li>
    </ul>

    
    <ScrollArea>
      <table class="data-table">

    <thead>
        <tr>
            {#each tableCols as col}
                {#if !filter.hiddenCols.includes(col.id)}
                    <td class="{(col.fixed ? "data-table-fixed-col":"")}" style="{ filter.widthCols.hasOwnProperty(col.id) ? "min-width:"+filter.widthCols[col.id]+"px;":""} {col.fixedOffset ? "left:"+col.fixedOffset+"px;":""}">
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

            <td>
            <button class="btn btn-error btn-circle" data-tooltip-position="left,bottom" use:OverlayMenuService.tooltip data-tooltip="Force Reload all, Close other Sessions" on:click={()=>{forceReloadAll()}}>
                            <Icon src={ArrowPath}></Icon>
                        </button> 
          </td>
        </tr>
    </thead>
    <tbody>
        {#each list as dev}
            <tr class={"det-device"}>
                {#each tableCols as col}
                    {#if !filter.hiddenCols.includes(col.id)}
                        <td class="{(col.fixed ? "data-table-fixed-col":"")}" style="{col.fixedOffset ? "left:"+col.fixedOffset+"px;":""}">

                          {#if col.id == "state"}
                          <div class="badge badge-{ dev.failed ? (dev.sessionConflict ? "warning":"error") : "success"} badge-sm" data-tooltip-position="right,bottom" use:OverlayMenuService.tooltip data-tooltip={dev.error}></div>
                          {/if}

                            {#if col.id == "sn"}
                            <span>{dev.sn}</span>
                            {/if}


                            {#if col.id == "name"}
                            {#if batchActive}
                                <button class="btn btn-error btn-circle" data-tooltip-position="right,bottom" use:OverlayMenuService.tooltip data-tooltip="Send Batch Command" on:click={()=>{batchJob(dev.sn)}}>
                                  <Icon src={CodeBracket}></Icon>
                              </button> 
                              {/if}
                            {dev.name} <small>({dev.direction})</small>
                            {/if}

                            {#if col.id == "type"}
                            {dev.type}
                            {/if}

                            {#if col.id == "ip"}
                            {#each dev.ipList as ip}
                            <a href={"https://"+ip+"/"} target="_blank">{ip}</a>
                            {/each}
                            {/if}



                            {#if col.id == "network"}
                              {#each dev.linkStatus as link}
                              <div>
                                <span>
                                {#if link.up}
                                  <div class="badge badge-success" use:OverlayMenuService.tooltip data-tooltip={link.speed}></div>
                                {:else}
                                  <div class="badge badge-error"></div>
                                {/if}
                                {link.name}: {link.ip}
                              </span>
                              </div>
                              {/each}
                            {/if}



                            {#if col.id == "fwversion"}
                            {dev.firmwareVersion}
                            {#if dev.safeMode}
                              Safe Mode
                            {/if}
                            {#if dev.goldenMode}
                              Golden Mode
                            {/if}
                            {/if}

                            {#if col.id == "fwmode"}
                            {dev.simpleMode}
                            {/if}


                            {#if col.id == "temperature"}
                            {dev.temperature}
                            {/if}



                            {#if col.id == "frontpanelLock"}
                              {#if dev.frontpanelLock}
                                Locked
                              {:else}
                                
                              {/if}
                            {/if}

                            {#if col.id == "hdcpEnabled"}
                            {#if dev.hdcpEnabled}
                                <div class="badge badge-success badge-sm"></div>
                              {:else}
                                <div class="badge badge-info badge-outline badge-sm"></div>
                              {/if}
                            {/if}

                            {#if col.id == "jpegxsLicensed"}
                              {#if dev.jpegxsLicensed}
                                <div class="badge badge-success badge-sm"></div>
                              {:else}
                                <div class="badge badge-info badge-outline badge-sm"></div>
                              {/if}
                            {/if}


                            {#if col.id == "flowMode"}
                              {dev.flowMode}
                            {/if}

                            {#if col.id == "ptpStatus"}
                            <span>
                              {#if dev.ptpStatus == "FollowerLocked" }
                              <div class="badge badge-success badge-sm"></div>
                              {:else if dev.ptpStatus == "FollowerNoLeaderFound"}
                              <div class="badge badge-error badge-sm"></div>
                              {:else}
                              <div class="badge badge-warning badge-sm"></div>
                              {/if}
                              {dev.ptpStatus}
                            </span>
                            {/if}
                            {#if col.id == "ptpDomain"}
                              {dev.ptpDomain} 

                              {#if dev.ptpDomain != sourceState.ptpDomain}
                                <button class="btn btn-info btn-circle" use:OverlayMenuService.tooltip data-tooltip="Set PTP Domain to {sourceState.ptpDomain}" on:click={()=>{fixPtpDomain(dev.sn)}}>
                                  <Icon src={ArrowUturnLeft}></Icon>
                              </button> 
                              {/if}
                            {/if}







                            {#if col.id == "masterEnabled"}
                            <div class="table-cell">
                              <div class="table-contente"></div>
                              <div class="table-function"></div>
                            </div>
                            <div class="badge badge-{ dev.masterEnabled ? "success" : "error"} badge-sm"></div>
                            {/if}

                            {#if col.id == "masterEnabledMenu"}


                                <button class="btn btn-circle" on:click={(evt)=>{menu.open({entry:[{
                                  label:"Enable",callback:()=>{enableMaster(dev.sn)}
                                }]},evt)}}>
                                  <Icon src={EllipsisVertical}></Icon>
                                </button>


                                
                                {/if}

                            {#if dev.direction == "tx"}

                                {#if col.id == "audioFormat"}
                                  {#if dev.inputAudioPresent}
                                    { dev.inputAudio }
                                    {:else}
                                      <div class="badge badge-info badge-outline badge-sm"></div>
                                      Not present
                                    {/if}
                                {/if}
                                {#if col.id == "inputResolution"}
                                    {#if dev.inputPresent}
                                    
                                      <div class="badge badge-success badge-sm"></div>
                                      {dev.inputResolution}
                                    
                                    {:else}
                                    
                                      <div class="badge badge-info badge-outline badge-sm"></div>
                                      Not present
                                    
                                    {/if}
                                {/if}

                                {#if col.id == "scalerMode"}
                                <div class="table-cell">
                                  <div class="table-contente"></div>
                                  <div class="table-function"></div>
                                </div>
                                  {dev.outputMode}

                                  {/if}
                                  {#if col.id == "scalerModeMenu"}
                                  <button class="btn btn-circle" on:click={(evt)=>{menu.open(getMenuTxScalerMode(dev),evt)}}>
                                    <Icon src={EllipsisVertical}></Icon>
                                  </button>
                                {/if}

                                {#if col.id == "outputResolution"}
                                    

                                    {#if dev.outputPresent}
                                          {dev.outputResolution}
                                    {:else}
                                        Not active
                                    {/if}
                                {/if}

                                {#if col.id == "edidModeMenu"}
                                  <button class="btn btn-circle" on:click={(evt)=>{menu.open(getMenuInputEdid(dev),evt)}}>
                                    <Icon src={EllipsisVertical}></Icon>
                                  </button>
                                  {/if}

                                


                            {/if}

                            {#if dev.direction == "rx"}

                            {#if col.id == "audioFormat"}
                              {#if dev.inputAudioPresent}
                                { dev.inputAudio }
                              {:else}
                                  <div class="badge badge-info badge-outline badge-sm"></div>
                                  Not present
                                {/if}
                              {/if}

                                {#if col.id == "inputResolution"}

                                {#if dev.inputPresent}
                                
                                        <div class="badge badge-success badge-sm"></div>
                                        {dev.inputResolution}
                                      
                                        
                                    {:else}
                                        
                                    
                                          <div class="badge badge-info badge-outline badge-sm"></div>
                                          Not present
                                        
                                    {/if}

                                    {/if}

                                {#if col.id == "scalerMode"}
                                {dev.moinitorMode}
                                {/if}

                                {#if col.id == "scalerModeMenu"}

                                <button class="btn btn-circle" on:click={(evt)=>{menu.open(getMenuRxScalerMode(dev),evt)}}>
                                  <Icon src={EllipsisVertical}></Icon>
                                </button>


                                
                                {/if}

                                {#if col.id == "outputResolution"}
                                
                                  {dev.outputResolution}
                                {/if}

                            
                            {/if}

                            {#if col.id == "edidNativeResInput"}
                            {dev.edidNativeResInput}
                            {/if}

                            {#if col.id == "edidInput"}
                            {dev.edidInput}

                            {/if}

                            {#if col.id == "edidMonitor"}
                            {dev.edidMonitor}
                                {/if}

                                {#if col.id == "edidNativeResMonitor"}
                                {dev.edidNativeResMonitor}
                                {/if}
                        </td>
                    {/if}
                {/each}
                <td>
                    {#if dev.loading}
                        <button class="btn btn-circle btn-info" data-tooltip-position="left,bottom" use:OverlayMenuService.tooltip data-tooltip="Reload Active">
                            <Icon src={ArrowPath}></Icon>
                        </button>
                    {:else if dev.sessionConflict}
                        <button class="btn btn-error btn-circle" data-tooltip-position="left,bottom" use:OverlayMenuService.tooltip data-tooltip="Force Reload, Close other Sessions" on:click={()=>{forceReload(dev.sn)}}>
                            <Icon src={ArrowPath}></Icon>
                        </button>
                    {:else}
                        <button class="btn btn-circle" data-tooltip-position="left,bottom" use:OverlayMenuService.tooltip data-tooltip="Force Reload, Close other Sessions" on:click={()=>{forceReload(dev.sn)}}>
                            <Icon src={ArrowPath}></Icon>
                        </button>
                    {/if}
                </td>
            </tr>
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


  <dialog bind:this={tableModal} class="modal">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <h3>Hide Table Cols</h3>
      {#each tableCols as col}
      {#if col.name != "" && col.canHide}
      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">{col.name}</span> 
          <input type="checkbox" checked={filter.hiddenCols.includes(col.id)} on:change={()=>{toggelHiddenCol(col.id);}} class="checkbox" />
        </label>
      </div>
      {/if}
      {/each}
      <div class="modal-action">
          <button class="btn" on:click={()=>{toggelHiddenCol("")}}>Show All</button>
      </div>
    </div>
  </dialog>



  <dialog bind:this={batchModal} class="modal">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <h3>Batch Job</h3>
      <div class="form-control">
        <label class="label cursor-pointer gap-2">
          <span class="label-text">Batch Visible</span> 
          <input bind:checked={batchActive} type="checkbox" class="toggle" />
        </label>
        <label class="label cursor-pointer">
          <span class="label-text">Batch JSON (Context API)</span> 
          <textarea on:input={()=>saveFilter()} bind:value={filter.batchJob} class="textarea textarea-bordered"></textarea>
        </label>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">Reboot After Command</span> 
          <input on:input={()=>saveFilter()} bind:checked={filter.batchJobReboot} type="checkbox" class="toggle" />
        </label>
      </div>
      
    </div>
  </dialog>