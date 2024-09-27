<script lang="ts">
    import { info } from "autoprefixer";
    import ServerConnector from "../lib/ServerConnector/ServerConnectorService"
    import type { Subject } from "rxjs";
    import { onDestroy, onMount } from "svelte";

    import JsonTree from 'svelte-json-tree';
    import ScrollArea from "../lib/ScrollArea.svelte";
    import { ChevronRight, Icon, MagnifyingGlass, RectangleGroup } from "svelte-hero-icons";
    import PrettyJson from "../lib/PrettyJson.svelte";
    import { getSearchTokens, tokenSearch } from "../lib/functions";
    


    let tableCols = [
        {id:"time", name:"Time" ,          sortable:false,  resize:false  },
        {id:"severity", name:"Severity" ,          sortable:false,  resize:false  },
        {id:"topic", name:"Topic" ,          sortable:false,  resize:false  },
        {id:"text", name:"Text" ,          sortable:false,  resize:false  },
    ]


    let state:any = {};
    let logList:any[] = [];
    let uiList:any[] = [];
    let sync:Subject<any> ;

    let filter = {
        version:"346721",
        searchTopic:"",
        search:"",
        severity:{
            error:true,
            waring:true,
            info:false,
            verbose:false,
            debug:false,
        }
    }
    let stopScrollId = 0;
    let stopScrollActive = false;
    let expandedIds:string[] = [];
    let newIds:string[] = [];

    let filterIds:string[]|undefined = [];
    

    function toggleExpand(id:string){
        let saveindex = expandedIds.indexOf(id);
      if(saveindex == -1){
        expandedIds.push(id);
      }else{
        expandedIds.splice(saveindex,1);
      }
      uiList = [...uiList]
    }

    function removeNewId(id:string){
        let saveindex = newIds.indexOf(id);
      if(saveindex == -1){
        
      }else{
        newIds.splice(saveindex,1);
      }
      uiList = [...uiList]
    }

    function isNew(id:string){
      if(newIds.includes(id)){
        return true;
      }
      return false;
    }

    function isExpanded(id:string){
      if(expandedIds.includes(id)){
        return true;
      }
      return false;
    }

    onMount(async () => {

      let params = new URLSearchParams(window.location.search);
      if(params.has("filterIds")){
        filterIds = params.get("filterIds")?.split("||");
      }
      // TODO clear filter IDs in UI

      sync = ServerConnector.sync("log")
        sync.subscribe((obj:any)=>{
            state = obj;
            updateList()
      });

      try{
        let f = localStorage.getItem("log_filter");
        if(f){
          let tempFilter = JSON.parse(f);
          if(tempFilter.version == filter.version){
            filter = tempFilter;
          }else{
            console.log("Resetting detail filter localstorage.");
          }
        }
      }catch(e){}
      changeFilter();
    });
    onDestroy(() => {
      sync.unsubscribe();
    ServerConnector.unsync("log")
    });

    function saveFilter(){
        localStorage.setItem("log_filter", JSON.stringify(filter));
    }

    function changeFilter(){
        setTimeout(()=>{
        if(stopScrollActive && stopScrollId == 0){
            stopScrollId = lastLogId;
        }
        if(stopScrollActive == false){
            stopScrollId = 0;
        }
        doFilter();
        saveFilter();
    },10)
    }


    function doFilter(){
        uiList = [];
        let count = 0;
        logList.forEach((log)=>{
          if(filterIds && filterIds.length > 0){
                if(filterIds.includes(log.id+"")){
                  uiList.push(log)
                }
                return;
              }
            if(count < 1000){

              

                if(stopScrollId){
                    if(log.id <= stopScrollId){
                        // use
                    }else{
                        return;
                    }
                }

                if(log.severity == "error" && filter.severity.error == false){
                    return;
                }
                if(log.severity == "waring" && filter.severity.waring == false){
                    return;
                }
                if(log.severity == "info" && filter.severity.info == false){
                    return;
                }
                if(log.severity == "verbose" && filter.severity.verbose == false){
                    return;
                }
                if(log.severity == "debug" && filter.severity.debug == false){
                    return;
                }


                if(filter.search != ""){
                  let searchTokens = getSearchTokens(filter.search);
                  let cipFound = tokenSearch(log, searchTokens,["text"] );
                  if(!cipFound){
                    return;
                  }
                }

                if(filter.searchTopic != ""){
                  let searchTokens = getSearchTokens(filter.searchTopic);
                  let cipFound = tokenSearch(log, searchTokens,["topic"] );
                  if(!cipFound){
                    return;
                  }
                }

                uiList.push(log)
                count++;
            }
        })

    }

    let lastLogId = 0;
    
    function updateList(){
        try{
            if(state.lastLogId < lastLogId){
                lastLogId = 0;
                logList = [];
            }
            state.logList.forEach((log:any)=>{
                if(log.id <= lastLogId){
                    // Ignore this message
                }else{
                    lastLogId = log.id;
                    logList.unshift(log);
                    if (logList.length > 20000) {
                        logList.shift();
                    }
                    newIds.push(log.id);
                    setTimeout(()=>{
                        removeNewId(log.id);
                    },500);
                }
            });
        }catch(e){console.log(e)}
        
        doFilter();
    }



    function renderTime(time:string){
        let d = new Date(time);

        let twodigit = (n:number|string)=>{
            n = ""+n;
            if(n.length == 1){
                n = "0"+n;
            }
            return n
        }
        return  d.getFullYear() + "/"+ twodigit(d.getMonth()+1) + "/"+ twodigit(d.getDate())  + " " + twodigit(d.getHours()) + ":" + twodigit(d.getMinutes()) + ":" + twodigit(d.getSeconds()) + "." + twodigit(d.getMilliseconds());
        
    }


  </script>


<div class="content-container">


    <ul class="menu bg-base-200 menu-horizontal rounded-box filter-nav">
      <li>
        <label class="input input-ghost flex gap-2">
          <input bind:value={filter.search} on:input={()=>changeFilter()} type="text" class="grow" placeholder="Search" />
          <Icon src={MagnifyingGlass}></Icon>
        </label>
      </li>
      <li>
        <label class="input input-ghost flex gap-2">
          <input bind:value={filter.searchTopic} on:input={()=>changeFilter()} type="text" class="grow" placeholder="Search Topic" />
          <Icon src={RectangleGroup}></Icon>
        </label>
      </li>
      <li>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">Error</span> 
          <input on:input={()=>changeFilter()} bind:checked={filter.severity.error} type="checkbox" class="toggle" />
        </label>
      </li>

      <li>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">Waring</span> 
          <input on:input={()=>changeFilter()} bind:checked={filter.severity.waring} type="checkbox" class="toggle" />
        </label>
      </li>

      <li>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">Info</span> 
          <input on:input={()=>changeFilter()} bind:checked={filter.severity.info} type="checkbox" class="toggle" />
        </label>
      </li>

      <li>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">Verbose</span> 
          <input on:input={()=>changeFilter()} bind:checked={filter.severity.verbose} type="checkbox" class="toggle" />
        </label>
      </li>

      <li>
        <label class="label cursor-pointer gap-2">
          <span class="label-text">Debug</span> 
          <input on:input={()=>changeFilter()} bind:checked={filter.severity.debug} type="checkbox" class="toggle" />
        </label>
      </li>

      {#if filterIds && filterIds.length > 0}
      <li>
        <button on:click={()=>{filterIds = []; changeFilter()}}>Clear ID filter</button>
      </li>
      {/if}
      
    </ul>

    
    <ScrollArea autoHide={false}>
  <table class="data-table">

    <thead>
        <tr>
            <td></td>
            {#each tableCols as col}
                <td>{col.name}</td>
            {/each}
        </tr>
    </thead>
    <tbody>
        {#each uiList as log}
            <tr on:dblclick={()=>{toggleExpand(log.id)}} class="log-line {(isNew(log.id) ? "log-line-new":"")}">
              {#if log.raw}
                <td on:click={()=>{toggleExpand(log.id)}}><span class={"data-table-expand "+ (isExpanded(log.id) ? "data-table-expand-active":"")}><Icon src={ChevronRight}></Icon></span></td>
              {:else}
                <td></td>
              {/if}
                {#each tableCols as col}
                        <td>

                            {#if col.id == "time"}
                            <span>{renderTime(log.time)}</span>
                            {/if}

                            {#if col.id == "severity"}
                                {#if log.severity == "error"}
                                    <div class="badge badge-error badge-sm">Error</div>
                                {/if}

                                {#if log.severity == "warning"}
                                    <div class="badge badge-warning badge-sm">Warning</div>
                                {/if}

                                {#if log.severity == "info"}
                                    <div class="badge badge-info badge-sm">Info</div>
                                {/if}

                                {#if log.severity == "verbose"}
                                    <div class="badge badge-purple badge-sm">Verbose</div>
                                {/if}

                                {#if log.severity == "debug"}
                                    <div class="badge badge-pink badge-sm">Debug</div>
                                {/if}
                            
                            {/if}

                            {#if col.id == "topic"}
                            {log.topic}
                            {/if}

                            {#if col.id == "text"}
                            {log.text}
                            {/if}
                        </td>
                  
                {/each}
            </tr>
            {#if isExpanded(log.id)}
                <tr class="data-table-expanded">
                    <td></td>

                    <td colspan=4 style="padding-bottom:40px !important;">
                      {#if log.raw}
                        <PrettyJson json={log.raw}></PrettyJson>
                      {:else}
                        No data available
                      {/if}
                    </td>
                </tr>
              {/if}
        {/each}
    </tbody>

  </table>
</ScrollArea>

    
  </div>