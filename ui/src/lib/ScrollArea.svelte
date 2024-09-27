<script lang="ts">
    import { onMount } from "svelte";

    import { Svroller } from 'svrollbar'

    export let autoHide = true;
    export let minScrollSize = 50

    let container:Element;
    let innerContainer:Element;
    onMount(async () => {
        setTimeout(()=>{
            
        },500);
        
    })
    function show(){if(hideTimer){
            clearTimeout(hideTimer);
        }
        hideTimer = setTimeout(()=>{
            hide();
        },5000)
        //outerContainer.classList.add("visible")
    }
    function hide(){
        hideTimer = null;
        //outerContainer.classList.remove("visible")
    }
    let hideTimer:any = null;
    

    
</script>

<div  style="overflow:scroll; width:100%; height:100%">
    <slot />
</div>

