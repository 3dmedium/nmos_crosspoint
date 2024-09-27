<script lang="ts">
    import ServerConnector from "../lib/ServerConnector/ServerConnectorService"
    import { writable } from 'svelte/store';
      import type { Subject } from "rxjs";
      import { onDestroy, onMount } from "svelte";

      import SwitchNode from "../lib/SvelteFlowNodes/SwitchNode.svelte"
      import DeviceNode from "../lib/SvelteFlowNodes/DeviceNode.svelte"

      import {
            SvelteFlow,
            Controls,
            MiniMap
        } from '@xyflow/svelte';

        import type { Node, Edge } from '@xyflow/svelte';

        import '@xyflow/svelte/dist/style.css';
  
    let state = {
      devices:[],
      infrastructure:[]
    };

    const nodeTypes = {
      switch: SwitchNode,
      device: DeviceNode
    }
  
    let sync:Subject<any> ;
  
    onMount(async () => {
      sync = ServerConnector.sync("topology")
          sync.subscribe((obj:any)=>{
        state = obj;
        renderState();
      });
      });
  
    onDestroy(() => {
      sync.unsubscribe();
          ServerConnector.unsync("topology")
    });


      let nodes = writable<Node[]>([]);
      let edges = writable<Edge[]>([]);

      function renderState(){
        let n:any[] = [];
        let i = 0;
        state.infrastructure.forEach((dev)=>{
          // TODO calculate Positions
          if(dev){
          n.push({
              id: ''+i,
              type: 'switch',
              data: dev,
              position: { x: 100, y: 150 }
            })
          }
          i++;

        })
        nodes.set(n)

      }
    
  </script>
  

  <div class="topology-container" style:height="500px">
    <SvelteFlow
      connectionMode="loose"
      {nodes}
      {edges}
      {nodeTypes}
      fitView
      on:nodeclick={(event) => console.log('on node click', event.detail.node)}
    >
      <Controls />
      <MiniMap />
    </SvelteFlow>
  </div>