<script lang="ts">
    
    import { onDestroy, onMount } from "svelte";
    import ServerConnector from "../lib/ServerConnector/ServerConnectorService";

    
    let state:any = {deviceTypes:[]};
    let sync:any;

    onMount(async () => {
      sync = ServerConnector.sync("mediadevices")
      sync.subscribe((obj:any)=>{
            state = obj;
            
            
      });
    });
    onDestroy(() => {
        sync.unsubscribe();
        ServerConnector.unsync("mediadevices")
    });


  </script>
  


  <div class="content-container">
    <div class="content-container-scroll">
      <table class="data-table">

    <thead>
        <tr>
                    <td>
                      <span>Device Type</span>
                    </td>
                
            <td>
              <span>Count</span>
          </td>
          <td></td>
        </tr>
    </thead>
    <tbody>
          {#each state.deviceTypes as dev}
            <tr style="cursor:pointer;" on:click={()=>{
                document.location.href = "/mediadevices/"+ dev.name;
            }}>
                <td>
                    {dev.label}
                </td>

                <td>
                    <span>Total: {dev.count}</span>
                </td>
                
                <td>
                  {#if dev.error > 0}
                  <span class="text-error">Error: {dev.error}</span>
                  {/if}
                </td>
                

                {#each dev.detail as detail}
                <td>
                    <span class="text-{detail.color}">{detail.label}: {detail.count}</span>
                </td>
                {/each}
                <td colspan="5">{dev.note}</td>
            </tr>
            {/each}
    </tbody>

  </table>
</div>

    
  </div>
