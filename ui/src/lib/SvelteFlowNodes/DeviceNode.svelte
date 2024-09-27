<script lang="ts">
    import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  
    type $$Props = NodeProps;
  
    let data:any = {};


  </script>
  
  <div class="tp-switch-node">
    <Handle type="target" position={Position.Top} />
   Device Node
    <Handle type="source" position={Position.Bottom} id="a" style="left: 10px;" />
    <Handle type="source" position={Position.Bottom} id="b" style="left: auto; right: 10px;" />
  </div>
  