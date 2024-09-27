const { spawn } = require('node:child_process');


// TODO service file

let args = process.argv.slice(2);
let serverProcess:any = null;
function runServer(){
    serverProcess = spawn(__dirname+"/server.js",args,{});
    serverProcess.on("error", (err)=>{
        console.error("Service Error: ", err);
    });
    serverProcess.on("data", (data)=>{
        console.log("Service Data: ", data);
    });

}

runServer();


