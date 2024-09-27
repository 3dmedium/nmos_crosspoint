<script lang="ts">
    import ServerConnector from "../lib/ServerConnector/ServerConnectorService"
    import type { Subject } from "rxjs";
    import { onDestroy, onMount } from "svelte";

    import JsonTree from 'svelte-json-tree';
    


        let state:any = {};
    let sync:Subject<any> ;
    

    onMount(async () => {
      sync = ServerConnector.sync("connectionState")
        sync.subscribe((obj:any)=>{
            state = obj;
      });
    });
    onDestroy(() => {
      sync.unsubscribe();
    ServerConnector.unsync("connectionState")
    });

      function saveFilter(){
      localStorage.setItem("nmos_details_filter", JSON.stringify(filter));
    }


  </script>
  
  <div style="width:100%; display:flex; flex-direction:column; background-color:black; overflow-y:scroll; height:100%;">
    <div style="flex-grow:0; flex-shrink:0; padding:0.5rem; text-align:center;">
      <ul class="menu bg-base-200 menu-horizontal rounded-box filter-nav">
      <li>
        <button>
          State Display only... TODO, Implement
        </button>
      </li>

      </ul>
  </div>
  <div style="flex-grow:2;" class="setup-container">
    <JsonTree value={state} shouldShowPreview={true} defaultExpandedLevel={2}
        --json-tree-property-color="#a6e22e"
        --json-tree-string-color="#f25a00"
        --json-tree-symbol-color="#66d9ef"
        --json-tree-boolean-color="#c594c5"
        --json-tree-function-color="#c594c5"
        --json-tree-number-color="#f99157"
        --json-tree-label-color="#f92672"
        --json-tree-arrow-color="#ae81ff"
        --json-tree-null-color="#66d9ef"
        --json-tree-undefined-color="#66d9ef"
        --json-tree-date-color="#fd971f"
        --json-tree-operator-color="#f8f8f2"
        --json-tree-regex-color="#9effff"
        --json-tree-li-identation="2em"
        --json-tree-li-line-height="1.5"
        --json-tree-font-size="16px"
        --json-tree-font-family="monospace"
    /></div>
  </div>