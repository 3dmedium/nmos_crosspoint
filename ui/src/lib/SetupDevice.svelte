<script lang="ts">
    import ServerConnector from "./ServerConnector/ServerConnectorService";

    export let deviceId:string="";
    let source = "";
    let loading = true;
    let flow:any = {};

    $: updateSource(deviceId);

    function updateSource(id:string){
        if(id != ""){
        loading = true;
        if(id.startsWith("nmos_")){
            source="nmos";
        }
        if(id.startsWith("nmosgrp_")){
            source="nmosgrp";
        }
        ServerConnector.get("deviceInfo/"+id).then((f:any)=>{
            flow = f;
            loading = false;
        }).catch((e)=>{
            loading = false;
        });
    }
        
    }
</script>
  
{#if source == "nmosgrp"}
    <h2>Setup Device <small>( {deviceId} )</small></h2>
    
    {#if loading}
    <div>Reload</div>
        <div>Loading</div>
    {:else}
        
    {/if}

{/if}

  