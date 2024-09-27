import { applyPatch, createPatch } from 'rfc6902';
import { ReplaySubject, Observable, Subject, BehaviorSubject } from 'rxjs';

//import * as Crypto from "crypto";

import sha256 from "js-sha256"


interface ServerFeedback {
  level:"error"|"success"|"info"|"warning";
  message:string;
  data?:any
  hidden?:boolean;
  time?:number;
  id?:number;
  click?:any
}

interface Connection {
    subscription: any;
    ws: WebSocket;
}
interface ConnectionList {
    [name: string]: Connection;
}

class _ServerConnector {

    authTimeout = 3600*1000;
    closedAuthTimeout = 60*1000;

    overlayFeedback:Subject<any>;
    overlayLoading:Subject<any>;
    authRequest:Subject<any>
    overlayLoadingRefCount = 0
    overlayFeedbackNextId = 0;

    authTimer:null|any = null;

    overlayFeedbackList:ServerFeedback[] = [];

    public addFeedback(feedback:ServerFeedback){
      if(feedback.time == undefined){
        feedback.time = 5000
      }
      if(feedback.hidden == undefined){
        feedback.hidden = false;
      }
      if(!feedback.hasOwnProperty("data")){
        feedback.data = {type:"none"}
      }
      let id = this.overlayFeedbackNextId++;
      feedback.id = id;
      this.overlayFeedbackList.push(feedback);
      this.overlayFeedback.next(this.overlayFeedbackList);
      setTimeout(()=>{
        this.overlayFeedbackList = this.overlayFeedbackList.filter((l)=>{
          if(l.id == id){
            return false;
          }
          return true;
        });
        this.overlayFeedback.next(this.overlayFeedbackList);
      }, feedback.time)

    }

    public startLoad(){
      this.overlayLoadingRefCount++;
      if(this.overlayLoadingRefCount > 0){
        this.overlayLoading.next(true);
      }else{
        this.overlayLoading.next(false);
      }
    }
    public endLoad(){
      this.overlayLoadingRefCount--;
      if(this.overlayLoadingRefCount < 0){
        this.overlayLoadingRefCount = 0;
      }
      if(this.overlayLoadingRefCount > 0){
        this.overlayLoading.next(true);
      }else{
        this.overlayLoading.next(false);
      }
    }




    private syncList: any = {};
    private requestPromises:any = {};
    
    states:any = {};


    connectionState:Subject<string> ;
    public connectionStateTrigger(){
      if(this.connected){
        this.connectionState.next("connected");
      }else{
        this.connectionState.next("disconnected");
      }

    }
    
    ws: WebSocket | null = null;
    wsUrl: string = '';
    error = '';
    connected = false;
    requestId = 0;
    reconnectTime = 1;
    reconnectTimeout: any = null;
    pingInterval: any = null;
    pingLastTime = 0;
    pingRoundtrip = -1;

    loading = 0;

    authSeed = "";
    user = "__noAuth";
    pass:string|null = "";
    lastUsername:string|null = "";

    public resetAuthTimer (){
      if(this.authTimer){
        clearTimeout(this.authTimer);
      }
      this.authTimer = setTimeout(()=>{
        this.doLogout()
        this.authTimer = null;
      }, this.authTimeout );
    }

    worker:any;
    constructor (){

      setInterval(()=>{
        
        try{
          let pass:any = localStorage.getItem("nmoscrosspoint_pass");
          if(pass){
            pass = JSON.parse(pass);
            if(pass.logout){
              this.doLogout();
              return;
            }else if(this.pass == "" && pass.time > (new Date().getTime() - this.closedAuthTimeout)){
              this.pass = pass.pass;
              this.sendAuth();
            }
          }else{
            
          }
        }catch(e){
          this.pass = "";
          this.doLogout();
          return;
        }

        if(this.pass){
          localStorage.setItem("nmoscrosspoint_pass",JSON.stringify({pass:this.pass,logout:false,time:new Date().getTime()}));
        }

      },this.closedAuthTimeout/4)
      

      
       
      this.resetAuthTimer();
      try{
        this.lastUsername = localStorage.getItem("nmoscrosspoint_lastUsername");
        if(!this.lastUsername){
          this.lastUsername = "";
        }
      }catch(e){}

      try{
        let pass:any = localStorage.getItem("nmoscrosspoint_pass");
        if(pass){
          pass = JSON.parse(pass);
          if(pass.time > (new Date().getTime() - this.closedAuthTimeout)){
            this.pass = pass.pass;
          }else{
            this.pass = "";
            localStorage.removeItem("nmoscrosspoint_pass");
          }
          
        }else{
          this.pass = "";
        }
      }catch(e){
        this.pass = "";
      }

      this.overlayFeedback = new Subject<any>();
      this.overlayLoading = new Subject<any>();
      this.authRequest = new Subject<any>();

      this.overlayFeedback.next(this.overlayFeedbackList);

      this.authRequest.next({request:false,username:this.lastUsername, denied:false, authDone:false});

      this.connectionState = new Subject<string>();

      this.disconnect();

      this.wsUrl = '';
      if (window.location.protocol == 'https') {
          this.wsUrl += 'wss://';
      } else {
          this.wsUrl += 'ws://';
      }
      this.wsUrl += window.location.hostname;
      if (
          (window.location.port == '443' && window.location.protocol == 'https') ||
          (window.location.port == '80' && window.location.protocol == 'http')
      ) {
          //port is default no changes
      } else {
          this.wsUrl += ':' + window.location.port;
      }
      this.wsUrl += '/sync/';

      setTimeout(()=>{
        this.connect();
      },10)

      let mode = localStorage.getItem("nmos_crosspoint_auto_take");
      if(mode == "true"){
          this.autoTake = true;
      }
    }

    public autoTake = false;
    public setAutoTake(mode:boolean){
      this.autoTake = mode;
      localStorage.setItem("nmos_crosspoint_auto_take", (mode ? "true":"false"));
    }
    public triggerGlobalTake(){

    }

    private resendSync(){
      for(let s in this.syncList){
        this.subscribeSync(this.syncList[s].channel, this.syncList[s].id);
      }
    }

    private disconnect() {
        if (this.ws) {
          try {
            this.ws.close();
          } catch (e) {}
        }
      }
    
      private connect() {
        this.ws = new WebSocket(this.wsUrl);
        this.ws.onopen = (event) => {
          
          

          this.pingLastTime = Date.now();
          if (this.ws) {
            this.ws.send('ping');

            this.connected = true;
          this.connectionState.next("connected");            

            this.reconnectTime = 1;
            setTimeout(() => {
              for (let key of Object.keys(this.syncList)) {
                this.subscribeSync(
                  this.syncList[key].channel,
                  this.syncList[key].objectId
                );
              }
            }, 1);
          }
        };
        this.ws.onclose = (event) => {

          this.connected = false;
          this.connectionState.next("disconnected");

          clearInterval(this.pingInterval);
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.reconnectTime < 60) {
              this.reconnectTime++;
            }
            this.connect();
          }, this.reconnectTime * 1000);
        };
        this.ws.onerror = (event) => {};
    
        this.ws.onmessage = (event) => {
          if (typeof event.data == 'string' && event.data.startsWith('pong')) {
            this.pingRoundtrip = Date.now() - this.pingLastTime;
          } else {
            this.processMessage(event.data);
          }
        };
        this.pingInterval = setInterval(() => {
          // TODO interval --->>> Timeout
          if (this.ws && this.ws.OPEN) {
            this.pingLastTime = Date.now();
            this.ws.send('ping');
          }
        }, 10000);
      }
    
      private processMessage(text: string) {
        let message;
        try {
          message = JSON.parse(text);
        } catch (e) {
          console.error('WebSocket bad message, not JSON');
          return;
        }
        switch (message.type) {
          case 'response':
            this.processResponse(message);
            break;
          case 'sync':
            this.processSync(message);
            break;
          case 'authseed':
            this.authSeed = message.seed;
            this.authRequest.next({request:false, username:message.user,denied:false, authDone:false});
            if(this.pass != ""){
              this.sendAuth();
            }
            break;
          case 'auth':
            this.user = message.user;
            this.authRequest.next({request:false, username:message.user,denied:false, authDone:true});
            this.resendSync();
            this.resetAuthTimer();
            break;
          case 'authfailed':
            this.user = "__noAuth";
            this.requestAuth(true);
            break;
          case 'permissionDenied':
            if(this.user == "__noAuth"){
              this.requestAuth();
            }else{
              this.addFeedback({
                level:"error",
                message:"Permission denied for Sync: "+message.data.name
              })
            }
        }
      }

      public requestAuth(denied = false){
        this.authRequest.next({request:true, username:this.lastUsername,denied, authDone:false});
      }
      public doAuth(user:string,pass:string){
        this.user = user;
        this.lastUsername = this.user;
        localStorage.setItem("nmoscrosspoint_lastUsername",this.user);
        this.pass = sha256.sha256(pass);
        localStorage.setItem("nmoscrosspoint_pass",JSON.stringify({pass:this.pass,logout:false,time:new Date().getTime()}));
        //this.worker.postMessage(JSON.stringify({__setPass:this.pass}));
        this.sendAuth();
      }
      public doLogout(){
        this.user = "__noAuth"
        this.pass = "";
        localStorage.setItem("nmoscrosspoint_pass",JSON.stringify({pass:this.pass,logout:true,time:new Date().getTime()}));
        this.disconnect();

      }
      private sendAuth(){
        let proof = this.pass+this.authSeed;
        proof = sha256.sha256(proof);
        if (this.connected && this.ws) {
          this.ws.send(
            JSON.stringify({
              type: 'auth',
              user: this.lastUsername,
              password: proof,
            })
          );
        }


      }
    
      private processResponse(message: any) {
        if (message.hasOwnProperty('id') && message.hasOwnProperty('status')) {
          if (this.requestPromises.hasOwnProperty(message.id)) {
            if (this.requestPromises[message.id].done) {
              console.error('Duplicate Server Answer for request');
            } else {
              if (message.status >= 200 && message.status < 400) {
                this.requestPromises[message.id].resolve({
                  status: message.status,
                  message:message.message,
                  data: message.data,
                });
              } else if (message.status >= 400) {
                this.requestPromises[message.id].reject({
                  status: message.status,
                  message: message.message,
                  error: message.error,
                });
              }
              this.requestPromises[message.id].done = true;
            }
          } else {
            console.error('WebSocket bad response, id out of range');
          }
        } else {
          console.error('WebSocket bad response, missing parameters');
        }
      }
    
      public getConnectionState() {
        if (this.connected) {
          return 'connected';
        }
    
        return 'connecting';
      }
    
      public get(route: string) {
        return this.request('GET', route);
      }
    
      public post(route: string, data: any = {}) {
        return this.request('POST', route, data);
      }
    
      public request(method: string, route: string, data: any = null) {
        this.resetAuthTimer();
        this.loading++;
        let id = this.requestId++;
        let promise = new Promise((resolve, reject) => {
          if (this.connected && this.ws) {
            this.ws.send(
              JSON.stringify({
                type: 'request',
                method: method,
                id: id,
                route: route,
                data: data,
              })
            );
    
            this.requestPromises[id] = {
              reject,
              resolve,
              id: id,
              requestRoute: route,
              requestData: data,
              requestMethod: 'POST',
              done: false,
            };
    
            setTimeout(() => {
              if (!this.requestPromises[id].done) {
                this.loading--;
                this.requestPromises[id].reject({
                  status: 503,
                  message: 'Request timed out',
                });
              }
    
              delete this.requestPromises[id];
            }, 60000);
          } else {
            reject({ status: 503, message: 'WebSocket connection not open' });
          }
        });
        return promise;
      }
    
      private processSync(message: any) {
        /*
          type: "publish",
          channel: channelName,
          objectId: objectId,
          action: action,
          data:state
        */
    
        if (
          message.hasOwnProperty('channel') &&
          typeof message.channel == 'string' &&
          message.hasOwnProperty('action') &&
          typeof message.action == 'string'
        ) {
          if (
            this.syncList.hasOwnProperty(message.channel + '_' + message.objectId)
          ) {
            switch (message.action) {
              case 'init':
                this.syncList[message.channel + '_' + message.objectId].state =
                  message.data;
                break;
              case 'patch':
                applyPatch(
                  this.syncList[message.channel + '_' + message.objectId].state,
                  message.data
                );
                break;
            }
    
            this.syncList[message.channel + '_' + message.objectId].observable.next(
              this.syncList[message.channel + '_' + message.objectId].state
            );
          }
        }
      }
    
      public sync(channel: string, id: string | number = 0): Subject<any> {
        this.resetAuthTimer();
        if (!this.syncList.hasOwnProperty(channel + '_' + id)) {
          this.syncList[channel + '_' + id] = {
            channel: channel,
            observable: null,
            objectId: id,
            state: undefined,
            refCount: 0,
          };
    
          this.syncList[channel + '_' + id].observable = new Subject<any>();
          this.subscribeSync(channel, id);
        }
        this.syncList[channel + '_' + id].refCount++;
        if (this.syncList[channel + '_' + id].state) {
          setTimeout(() => {
            this.syncList[channel + '_' + id].observable.next(
              this.syncList[channel + '_' + id].state
            );
          }, 0);
        }
        return this.syncList[channel + '_' + id].observable;
      }
      public unsync(channel: string, id: string | number = 0) {
        try {
          this.syncList[channel + '_' + id].refCount--;
          if (this.syncList[channel + '_' + id].refCount < 1) {
            this.stopSync(channel, id);
            delete this.syncList[channel + '_' + id];
          }
        } catch (e) {}
      }
    
      private subscribeSync(channel: string, objectId: string | number = 0) {
        if (this.connected && this.ws) {
          this.ws.send(
            JSON.stringify({
              type: 'sync',
              channel: channel,
              objectId: objectId,
            })
          );
        }
      }
      private stopSync(channel: String, objectId: string | number = 0) {
        if (this.connected && this.ws) {
          this.ws.send(
            JSON.stringify({
              type: 'unsync',
              channel: channel,
              objectId: objectId,
            })
          );
        }
      }


};

const ServerConnector: _ServerConnector = new _ServerConnector();
export default ServerConnector;

