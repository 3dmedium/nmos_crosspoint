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
    import OverlayMenuService from "../../lib/OverlayMenu/OverlayMenuService";
    import ScrollArea from "../../lib/ScrollArea.svelte";
    import { getSearchTokens, tokenSearch } from "../../lib/functions";


    let tableCols = [

        {id:"state", name:"", sortable:true,sortField:"error",  resize:false , canHide:false, fixed:true},
        {id:"name", name:"Name" ,     sortable:true,sortField:"name",  resize:true  , canHide:false, fixed:true, fixedOffset:40},

        {id:"ip", name:"IP Address" ,     sortable:true, sortField:"__customIpList", resize:true  , canHide:false},

        {id:"type", name:"Type" ,     sortable:true,sortField:"type",  resize:false  , canHide:true},
        {id:"mode", name:"Mode" ,     sortable:true,sortField:"mode",  resize:false  , canHide:true},
        {id:"firmware", name:"Firmware" ,     sortable:true,sortField:"firmware",  resize:false  , canHide:true},
        {id:"license", name:"License" ,     sortable:false,  resize:false  , canHide:true},
        
        
    ]

    

    

    let filter:any = {
      version:"112368",
      hiddenCols:[],
      widthCols:{},
      sortCols:[],
      search:"",
      searchIp:"",
    };


    

    let sourceState:any = {devices:{},settings:{edids:[],resolutions:[],ptpDomain:127},quickState:{
        label:"Riedel EM Plattform",
        name:"riedelembrionix",
        count:0,
        error:0,
        detail: [
          
        ],
        note:""
    }};
    let list:any = [];

    let menu = OverlayMenuService;

    let sync:Subject<any> ;


    onMount(async () => {
        sync = ServerConnector.sync("mediadevriedelembrionix")
        sync.subscribe((obj:any)=>{
            sourceState = obj;
             doFilter();
        });
      try{
        let f = localStorage.getItem("mediadevriedelembrionix_filter");
        if(f){
          let tempFilter = JSON.parse(f);
          if(tempFilter.version == filter.version){
            filter = tempFilter;
          }else{
            console.log("Resetting mmediadevriedelembrionix filter localstorage.");
            saveFilter();
          }
        }
      }catch(e){}
    });
    onDestroy(() => {
      sync.unsubscribe();
          ServerConnector.unsync("mediadevriedelembrionix")
    });

      function saveFilter(){
      localStorage.setItem("mediadevriedelembrionix_filter", JSON.stringify(filter));
    }

    function doFilter(){
        // TODO Filtering
        list = [];
        for(let emx in sourceState.devices){
            list.push(structuredClone(sourceState.devices[emx]))
        }
        if(filter.search != ""){
          let searchTokens = getSearchTokens(filter.search);    
          list = list.filter((emx:any)=>{
            return tokenSearch(emx, searchTokens, ["name"]);
          });
        }

        if(filter.searchIp != ""){
          let searchTokens = getSearchTokens(filter.searchIp);    
          list = list.filter((emx:any)=>{
            return tokenSearch(emx.ip.join(" "), searchTokens );
          });
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


              if(sortField == "__customIpList"){
                let comp = (a["ip"][0] as string).localeCompare(b["ip"][0],undefined, { sensitivity: 'accent' });
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

        console.log(list);

        // TODO Bug with Sort Cols not icon color updating on multiple changes
    }


      

     let tableModal:any;

      
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
        <span class="text-success " use:OverlayMenuService.tooltip data-tooltip="Total">{sourceState.quickState.count}</span><span>/</span>
        <span class="text-error" use:OverlayMenuService.tooltip data-tooltip="Errors">{sourceState.quickState.error}</span>
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
        </tr>
    </thead>
    <tbody>
        {#each list as dev}
            <tr class={"det-device"}>
                {#each tableCols as col}
                    {#if !filter.hiddenCols.includes(col.id)}
                        <td class="{(col.fixed ? "data-table-fixed-col":"")}" style="{col.fixedOffset ? "left:"+col.fixedOffset+"px;":""}">

                          {#if col.id == "state"}
                            <div class="badge badge-{ dev.error ? "error": "success"} badge-sm"></div>
                          {/if}

                            


                            {#if col.id == "name"}
                              {dev.name}
                            {/if}

                            {#if col.id == "type"}
                              {dev.type}
                            {/if}

                            {#if col.id == "mode"}
                              {dev.mode}
                            {/if}

                            {#if col.id == "ip"}
                              {#each dev.ip as ip}
                                <span><a href={"http://"+ip+":80/"} target="_blank">{ip}</a></span><br/>
                              {/each}
                            {/if}

                            {#if col.id == "firmware"}
                              {dev.firmware}
                            {/if}

                            {#if col.id == "license"}
                              {#each dev.license as lic }
                                {#if lic.licensed }
                                  <span><div class="badge badge-success badge-sm"></div>&nbsp;&nbsp;{lic.name}</span><br/>
                                {/if}
                              {/each}
                            {/if}

                            

                           
                        </td>
                    {/if}
                {/each}
                
            </tr>
        {/each}
    </tbody>

  </table>
</ScrollArea>

    
  </div>




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
