<script lang="ts">
    import { onMount } from "svelte";
    import ServerConnector from "./ServerConnectorService";
    import { Icon, User, Key } from "svelte-hero-icons";


let feedbackList:any[]= [];
let loading = false;
let authRequestModal:any;
let authRequestModalUser:any;
let authRequestModalPassword:any;
let authUser = ""
let authPass = ""
let authDenied = false;


onMount(async()=>{
    ServerConnector.overlayFeedback.subscribe((list)=>{
        feedbackList = list;
    })

    ServerConnector.overlayLoading.subscribe((load)=>{
        loading = load;
    })

    ServerConnector.authRequest.subscribe((data)=>{
        if(data.request == true){
            authUser = data.username;
            authDenied = data.denied;

            authRequestModal.showModal();
            if(authUser != ""){
                authRequestModalPassword.focus();
            }else{
                authRequestModalUser.focus();
            }
        }else{
            if(data.authDone == true){
                authRequestModal.close();
            }
        }
    })
});

function click(feedback:any){
    if(feedback.click){
        feedback.click();
    }else{
        feedback.hidden = true;
    }
}

function doLogin(){
    authRequestModal.close();
    ServerConnector.doAuth(authUser,authPass);
    authPass = "";
}



</script>




<dialog bind:this={authRequestModal} class="modal">
    <div class="modal-box">
        <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 class="text-lg font-bold">Login</h3>
        <div class="form-control">
            <div class="pt-8">
            <label class="input input-bordered flex gap-2">
                <input bind:this={authRequestModalUser} bind:value={authUser} type="text" class="grow" placeholder="Username" />
                <Icon src={User}></Icon>
            </label>
        </div>
        <div class="pt-4">
            <label class="input input-bordered flex gap-2">
                <input on:keypress={(e)=>{if(e.keyCode == 13) doLogin()}} bind:this={authRequestModalPassword}  bind:value={authPass} type="password" class="grow" placeholder="Password" />
                <Icon src={Key}></Icon>
            </label>
        </div>
            
            
            {#if authDenied}
                <span class="text-error" >Login failed.</span>
            {/if}

        </div>

        <div class="modal-action">
            <form method="dialog">
                <button class="btn" on:click={()=>{doLogin()}}>Login</button>
            </form>
        </div>
    </div>
</dialog>



<div class="overlay-server-feedback toast toast-bottom toast-end">
    {#each feedbackList as feedback}
        {#if !feedback.hidden }
            <div class="alert alert-{feedback.level}" on:click={()=>{click(feedback);}}>
                <span class="alert-title">{feedback.message}</span>

                {#if feedback.data.type == "connection"}
                    <span class="alert-text text-success">Flows connectd: {feedback.data.result.success}</span>
                    {#if feedback.data.result.disconnect }
                        <span class="alert-text text-info">Flows disconnected: {feedback.data.result.disconnect}</span>
                    {/if}
                    {#if feedback.data.result.failed }
                        <span class="alert-text text-error">Flows failed: {feedback.data.result.failed}</span>
                        <span class="alert-detail">
                            {#each feedback.data.result.reasons as r}
                            {r} 
                            {/each}
                        </span>
                    {/if}
                {/if}
            </div>
        {/if}
    {/each}
</div>


{#if loading }
    <div class="overlay-server-loading">
        <progress class="progress"></progress>
    </div>
{/if}




  