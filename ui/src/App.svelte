<script lang="ts">

  import { Router, Link, Route } from "svelte-routing";

  
  import { onDestroy, onMount } from 'svelte';

  import ServerConnector from "./lib/ServerConnector/ServerConnectorService";
  import OverlayMenuService from "./lib/OverlayMenu/OverlayMenuService";

  import { Icon, Squares2x2, Share, ListBullet, WrenchScrewdriver, ServerStack, LockOpen, LockClosed  } from "svelte-hero-icons";


  import Crosspoint from './routes/crosspoint.svelte';
  import Topology from './routes/topology.svelte';
  import Details from './routes/details.svelte';
  import Setup from './routes/setup.svelte';
  import Logging from './routes/logging.svelte';

  import Debug from './routes/debug.svelte';
  import Devices from './routes/devices.svelte';
  import Matroxcip from './routes/mediadevices/matroxcip.svelte';
  import Riedelembrionix from './routes/mediadevices/riedelembrionix.svelte';
    import OverlayMenu from "./lib/OverlayMenu/OverlayMenu.svelte";
    import ServerConnectorOverlay from "./lib/ServerConnector/ServerConnectorOverlay.svelte";
    import type { Subject } from "rxjs";

    let menu = OverlayMenuService;

  let routes = [
        {label:"Crosspoint", icon:Squares2x2, link:"/crosspoint"},
        
        
        {label:"Details", icon:ListBullet, link:"/details"},
        
        {label:"Topology", icon:Share, link:"/topology"},
        {label:"Devices", icon:ServerStack, link:"/mediadevices"},

        {label:"Setup",  icon:WrenchScrewdriver, link:"/setup"},
    ];

    let current_url = "/";
    let update_url=()=>{
      setTimeout(()=>{
        current_url = window.location.pathname;
      },50);
    };
    function doGlobalTake(){
      if(crosspointComponent){
        crosspointComponent.takeConnect()
      }
    };

    function openGlobalTakeModal(){
      if(crosspointComponent){
        crosspointComponent.openPreparedConnectModal();
      }
    }

    function updateGlobalTake(e:any){
      globalTakePreparedList = e.detail.prepared;
      globalTakePreparedListCount = globalTakePreparedList.length

      globalTakePreviewList = e.detail.preview;
      globalTakePreviewListCount = globalTakePreviewList.length
    }
    let globalTakePreparedListCount = 0;
    let globalTakePreparedList:any[] = [];
    let globalTakePreviewListCount = 0;
    let globalTakePreviewList:any[] = [];

    let connectionState = "connecting"

    let authUser = "";
    let authDone = false;

    let uiConfig = {
        "disabledModules":{
            "core":[""]
        }
    };
    function isDisabledModule(module:string){
      let search:string = module.slice(1)
      if(uiConfig.disabledModules.core.includes(search)){
        return true;
      }
      return false;
    }

    let uiConfigSync:Subject<any> ;
    onDestroy(() => {
      uiConfigSync.unsubscribe();
      ServerConnector.unsync("uiconfig");
    });
    onMount(()=>{
      
      uiConfigSync = ServerConnector.sync("uiconfig")
      uiConfigSync.subscribe((obj:any)=>{
        uiConfig = obj;
        routes = [...routes]
      });
      
      ServerConnector.connectionState.subscribe((state)=>{
        connectionState = ""+state;
      })

      ServerConnector.authRequest.subscribe((data)=>{
          authDone = data.authDone;
          authUser = data.username;    
      })

      setTimeout(()=>{
        ServerConnector.connectionStateTrigger();
      },1)
      update_url();

      autoTake = ServerConnector.autoTake;
      
      let mode = localStorage.getItem("nmos_crosspoint_dark_mode")
      if(mode == null){
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          dark_mode = true;
        }
      }else if(mode == "dark"){
        dark_mode = true;
        
      }
      set_theme();
    })

    let autoTake = false;
    function toggleAutotake(){
      ServerConnector.setAutoTake(autoTake);
    }

    let dark_mode = false;

    function set_theme() {
      setTimeout(()=>{
        if(dark_mode){
          document.documentElement.setAttribute('data-theme', 'dark')
        }else{
          document.documentElement.setAttribute('data-theme', 'light')
        }
      },10);
    }

    function save_theme() {
      setTimeout(()=>{
        if(dark_mode){
          localStorage.setItem("nmos_crosspoint_dark_mode", "dark")
        }else{
          localStorage.setItem("nmos_crosspoint_dark_mode", "light")
        }
      },10);
    }

    let crosspointComponent:any = null

    function doLogout(){
      ServerConnector.doLogout();
    }
    function doLogin(){
      ServerConnector.requestAuth();
    }


    function checkCurrentUrl(url:string, route:string){
      if(route.startsWith("/mediadevices") && current_url.startsWith("/mediadevices")){
        return true;
      }
      return url == route
    }

    

</script>

<Router>
  <div class="browser-layout">

    <div class="browser-work-area">
    <Route path="/"          ><Crosspoint bind:this="{crosspointComponent}" autoTake={autoTake} on:updateGlobalTake={(e)=>{updateGlobalTake(e)}}></Crosspoint></Route>
    <Route path="/crosspoint"><Crosspoint bind:this="{crosspointComponent}" autoTake={autoTake} on:updateGlobalTake={(e)=>{updateGlobalTake(e)}}></Crosspoint></Route>

    <Route path="/details" component={Details}/>
    <Route path="/topology" component={Topology}/>

    <Route path="/debug" component={Debug}/>
    <Route path="/logging" component={Logging}/>

    <Route path="/mediadevices/matroxcip" component={Matroxcip}/>
    <Route path="/mediadevices/riedelembrionix" component={Riedelembrionix}/>

    <Route path="/mediadevices" component={Devices}/>


    <Route path="/setup" component={Setup}/>

    <Route><h2>404 : Not found</h2></Route>




    </div>
    <nav class="browser-nav menu bg-base-200">
      <ul class="browser-nav-full">
        {#each routes as route}
          {#if !isDisabledModule(route.link)}
            {#if route.label == "Setup"}
              <li class=""></li>
            {/if}
            <li>
              <Link class={ ( checkCurrentUrl(current_url,route.link) ? "active" : "")} on:click={update_url} to={route.link}>
                <Icon src={route.icon} />
                <span>{route.label}</span>
              </Link>
            </li>
          {/if}
        {/each}

        
        <li class="">
          <label class="swap swap-rotate">
            <input type="checkbox" class="theme-controller" bind:checked={dark_mode} on:change={()=>{set_theme();save_theme();}} />
            <svg class="swap-on fill-current w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>
            <svg class="swap-off fill-current w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/></svg>
          </label>
        </li>

        <li class="">
          {#if authDone}
            <div class="login-status" on:click={(evt)=>{menu.open({entry:[
              { label:authUser,callback:()=>{} },
              { label:"Logout",callback:()=>{doLogout()} },
              ]},evt)}}>
              <Icon size="24" src={LockOpen} />
            </div>
          {:else}
          <div class="login-status" on:click={(evt)=>{menu.open({entry:[
            { label:"Login",callback:()=>{doLogin()} },
            ]},evt)}}>
              <Icon size="24" src={LockClosed} />
            </div>
          {/if}


        </li>
        <li>
          {#if connectionState != "connected"}
            <div class="disconnected-status">
              <span class="loading loading-ring loading-lg text-error"></span>
              <span class="text-error">Connecting</span>
            </div>
          {/if}
        </li>
      </ul>

      {#if current_url == "/" || current_url == "/crosspoint"}
      <ul class="global-take">
        {#if autoTake}
        <li>
          <span class="text-small text-red-600">{(globalTakePreviewListCount > 0 ? "Affected: "+globalTakePreviewListCount : "")}</span>
        </li>
        {:else}
        <li>
          <span on:click={()=>{openGlobalTakeModal()}} class="text-small text-red-600">{(globalTakePreparedListCount > 0 ? "Prepared: "+globalTakePreparedListCount : "")}</span>
        </li>
        {/if}
        <li>
          <label><span>Autotake</span>
            <input type="checkbox" class="toggle" bind:checked={autoTake} on:change={toggleAutotake} />
          </label>
        </li>
        <li>
          {#if !autoTake }
            <a class="bg-red-600 text-white" on:click={()=>{doGlobalTake()}}><span>TAKE</span></a>
          {:else}
            <a class="bg-red-300 text-white" ><span>TAKE</span></a>
          {/if}
        </li>
      </ul>
      {/if}
    </nav>
  </div>
</Router>

<ServerConnectorOverlay></ServerConnectorOverlay>
<OverlayMenu></OverlayMenu>


