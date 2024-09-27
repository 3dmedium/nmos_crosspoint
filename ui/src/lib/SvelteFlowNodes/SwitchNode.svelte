<script lang="ts">
    import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/svelte';
  
    type $$Props = NodeProps;
 
    export let id: $$Props['id']; id;
    //export let data: $$Props['data']; data;
    export let dragHandle: $$Props['dragHandle'] = undefined; dragHandle;
    export let type: $$Props['type']  = undefined; type;
    export let selected: $$Props['selected'] = undefined; selected;
    export let isConnectable: $$Props['isConnectable'] = undefined; isConnectable;
    export let zIndex: $$Props['zIndex'] = undefined; zIndex;
    export let width: $$Props['width'] = undefined; width;
    export let height: $$Props['height'] = undefined; height;
    export let dragging: $$Props['dragging']; dragging;
    export let targetPosition: $$Props['targetPosition'] = undefined; targetPosition;
    export let sourcePosition: $$Props['sourcePosition'] = undefined; sourcePosition;
    
    const updateNodeInternals = useUpdateNodeInternals();

    export let data: $$Props['data'];

    function isTopInterface(id:string){
      let parts = id.split("/");
      let num = parseInt(parts[0].substring(1));
      if(num%2 == 0){
        return false;
      }
      return true;
    }

  </script>
  
  <div class="tp-switch-node">

    <div class="tp-switch-row-top">
      {#each data.interfaces as int}
        {#if isTopInterface(int.id)}
        <div class="tp-switch-interface tp-switch-interface-{int.type}">
          <Handle type="target" id={int.id} position={Position.Top}/>
          {int.id}
        </div>
        {/if}
      {/each}
    </div>
    <div class="tp-switch-description">{data.name}</div>
    <div class="tp-switch-row-bottom">
      {#each data.interfaces as int}
        {#if !isTopInterface(int.id)}
        <div class="tp-switch-interface tp-switch-interface-{int.type}">
          <Handle type="target" id={int.id} position={Position.Bottom} />
          {int.id}
        </div>
        {/if}
      {/each}
    </div>

</div>
  