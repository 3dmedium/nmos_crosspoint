<script lang="ts">
    import ServerConnector from "./ServerConnector/ServerConnectorService";

    export let flowId:string="";
    let source = "";
    let loading = true;
    let flow:any|null = {};
    let manifest:any|null = {};
    let sdpFile:string = "";

    $: updateSource(flowId);

    function updateSource(id:string){
        if(id != ""){
        loading = true;
        if(id.startsWith("nmos_")){
            source="nmos";
        }
        ServerConnector.get("flowInfo/"+id).then((f:any)=>{
            flow = null;
            manifest = null;
            sdpFile = ""
            try{
                flow = f.data.flow;
            }catch(e){}
            try{
                manifest = f.data.manifest;
            }catch(e){}
            try{
                sdpFile = f.data.manifest._RAWSDP;
            }catch(e){}
            loading = false;
        });
    }
        
    }
</script>
  
{#if source == "nmos"}
    <h2>Setup Flow <small>( {flowId} )</small></h2>
    
    {#if loading}
        <div>Loading</div>
    {:else}
    <div>Reload</div>
        <div>
            Node, Device, Group, Sender
        </div>

        <div>
            Edit Label
        </div>

        <div>
            Change Multicast Config
        </div>

        <div>
            Activate
        </div>

        <div>
            Network Interfaces,
            Bitrates
        </div>

        <div>
            <pre>
            {sdpFile}        
            </pre>
        </div>
    {/if}

{/if}

  