<script lang="ts">
    import { onMount } from "svelte";
    import OverlayMenuService from "./OverlayMenuService";

let menuList:any[]= [];
onMount(async()=>{

    OverlayMenuService.tooltipObservable.subscribe((data)=>{
        tooltip = data;
    });

    OverlayMenuService.menuObservable.subscribe((list)=>{
        menuList = list;
        menuList.forEach((menu:any)=>{
            
            let height = menu.entry.length * 36;
            let width = 160 + 32;
            
            menu["uipos"] = menu.pos;
                if(menu.pos.y + height > window.innerHeight){
                    menu["uipos"].y -= height;
                }
                if(menu.pos.x + width > window.innerWidth){
                    menu["uipos"].x -= width;
                }

        })
    })
    document.addEventListener('click', outsideClick);
    document.addEventListener("dragover", (event) => {
        // TODO Fix for Table ??? wrong position
        event.preventDefault();
    });


})

function outsideClick(event:any){
    OverlayMenuService.closeAll();
}

function closeAll(){
    OverlayMenuService.closeAll()
}


let tooltip = {
    active:false,
    uipos:{y:0,x:0,mx:0,my:0},
    text:""
}




</script>


<div class="overlay-menu-container">
    {#each menuList as menu}
    <div class="overlay-menu" style="left:{menu.uipos.x}px; top:{menu.uipos.y}px">
        <ul class="">
            {#each menu.entry as entry}
                <li><a on:click={(e)=>{e.stopPropagation(); entry.callback(); closeAll(); return false;}}>{entry.label}</a></li>
            {/each}
          </ul>
    </div>
    {/each}
</div>

{#if tooltip.active}
<div class="overlay-tooltip" style="left:{tooltip.uipos.x}px; top:{tooltip.uipos.y}px; transform:translate(-{tooltip.uipos.mx}%,-{tooltip.uipos.my}%);">
    <span>{tooltip.text}</span>
</div>
{/if}
  