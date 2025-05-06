<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { createEventDispatcher } from 'svelte'

    const dispatch = createEventDispatcher();

    export let label = "";
    export let value = "";
    export let width:string|number = 6;
    export let tabindex = 0;

    let inputElement:HTMLInputElement|null;

    let active = false;
    function click(){
        console.log("dfjgsdfkj")
        try{
            if(inputElement){
                if(document.activeElement != inputElement){
                    inputElement.focus();
                }
            }
        }catch(e){}
        try{
            if(inputElement){
                if(document.activeElement != inputElement){
                   inputElement.setSelectionRange(-1,-1);
                }
            }
        }catch(e){}
        active = true;

    }

    function focus(){
        active = true;
    }

    function update(e:any){
        
        try{
            if(e.currentTarget.value != value){
                console.log(e.currentTarget.value);
                dispatch('update',e.currentTarget.value);
            }
        }catch(e){console.log(e)}
        active = false;
    }

  </script>
  


  <div class="inline-editor {active?"active":""}" style="width:{width}em" on:click={()=>{click();}}>
    <span class="inline-editor-label">{label + (active?"":value)}</span>
    <span class="inline-editor-value">
        <input bind:this={inputElement} style="opacity:{active?"1":"0"};" tabindex={tabindex} class="inline-editor-input" size="1" value={value}  
                on:blur={(e)=>{ update(e);}}
                on:focus={(e)=>{ focus();}}
        />
    </span>
  </div>