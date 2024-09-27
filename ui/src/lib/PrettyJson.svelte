<script lang="ts">
    import { info } from "autoprefixer";
    import ServerConnector from "../lib/ServerConnector/ServerConnectorService"
    import type { Subject } from "rxjs";
    import { onDestroy, onMount } from "svelte";

    import JsonTree from 'svelte-json-tree';
    import ScrollArea from "../lib/ScrollArea.svelte";
    import { ChevronRight, Icon, MagnifyingGlass, RectangleGroup } from "svelte-hero-icons";
    
    export let json:any = null

    let content = "";

    $: content = update(json);


    function replacer(match:any, pIndent:any, pKey:any, pVal:any, pEnd:any) {
      var key = '<span class=json-key>';
      var val = '<span class=json-value>';
      var str = '<span class=json-string>';
      var r = pIndent || '';
      if (pKey)
         r = r + key + pKey.replace(/[": ]/g, '') + '</span>: ';
      if (pVal)
         r = r + (pVal[0] == '"' ? str : val) + pVal + '</span>';
      return r + (pEnd || '');
      }
    function prettyPrint(obj:any) {
      var jsonLine = /^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{])?$/mg;
      return JSON.stringify(obj, null, 3)
         .replace(/&/g, '&amp;').replace(/\\"/g, '&quot;')
         .replace(/</g, '&lt;').replace(/>/g, '&gt;')
         .replace(jsonLine, replacer);
      }

      function update(json:any){
        let html = prettyPrint(json)
        return html
      }
   



    onMount(async () => {

    });
    onDestroy(() => {

    });
    



  </script>


<div class="pretty-json">

    <pre><code>{@html content}</code></pre>

</div>