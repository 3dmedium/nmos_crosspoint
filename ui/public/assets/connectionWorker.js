

var pass = "";

self.addEventListener("install", (event) => {
    console.log("install");
});
self.addEventListener("activate", (event) => {
    console.log("activate");
});

self.addEventListener("message", function(event) {  

    console.log(event)

    var data = JSON.parse(event.data);
    if(data.hasOwnProperty("__getPass")){
        event.source.postMessage(JSON.stringify({__pass:pass}));  
        console.log("get Pass: ")
    }

    if(data.hasOwnProperty("__setPass")){
        pass = data.__setPass
        
        console.log("set Pass: ")
    }

   //port.addEventListener("message", function(e) {
    //var data = JSON.parse(e.data);
    //if(data.hasOwnProperty("__getPass")){
    //    port.postMessage(JSON.stringify({__pass:pass}));  
    //    console.log("get Pass: "+pass)
//
    //}
    //if(data.hasOwnProperty("__setPass")){
    //    pass = data.__setPass
    //    console.log("set Pass: "+pass)
    //}

   //}, false); 
   ////  
   //port.start();  
}, false);