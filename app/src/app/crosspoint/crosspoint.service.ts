/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb
*/

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { applyPatch, createPatch } from 'rfc6902';

import { ReplaySubject, Observable, Subject, BehaviorSubject } from 'rxjs';

interface Connection {
  subscription: any;
  ws: WebSocket;
}
interface ConnectionList {
  [name: string]: Connection;
}

@Injectable({
  providedIn: 'root',
})
export class CrosspointService {
  constructor(private http: HttpClient) {
    this.state = new Subject<CrosspointState>();
    this.aliases = new Subject<any>();
    this.hidden = new Subject<any>();

    this.init();
  }

  public state: Subject<CrosspointState>;
  private _state: CrosspointState = {
    devices: {},
    sources: {},
    senders: {},
    receivers: {},
    flows: {},
    nodes: {},
  };

  public aliases: Subject<any>;
  private _aliases: any = {
    device: {},
    sender: {},
    receiver: {},
  };

  public hidden: Subject<any>;
  private _hidden: any = {
    sender_device: {},
    receiver_device: {},
    sender: {},
    receiver: {},
  };

  private connections: ConnectionList = {};

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

  private syncList: any = {};
  private requestPromises: any = {};

  init() {
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

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }

    this.sync('nmos').subscribe((obj) => {
      this._state = obj;
      this.state.next(this._state);
    });

    this.sync('aliases').subscribe((obj) => {
      this._aliases = obj;
      this.aliases.next(this._aliases);
    });

    this.sync('hidden').subscribe((obj) => {
      this._hidden = obj;
      this.hidden.next(this._hidden);
    });
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
              data: message.data,
            });
          } else if (message.status >= 400) {
            this.requestPromises[message.id].reject({
              status: message.status,
              message: message.message,
              data: message.data,
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
    if (!this.syncList.hasOwnProperty(channel + '_' + id)) {
      let obs = new Subject<any>();
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

  public makeConnectApi(receiverId: string, senderId: string) {
    return this.post('makeconnection', { receiverId, senderId });
  }
  public getActiveApi(senderId: string) {
    return this.post('getactive', { senderId });
  }
  public getTransportfileApi(senderId: string) {
    return this.post('gettransportfile', { senderId });
  }
}

interface CrosspointList {
  [name: string]: any;
}
export interface CrosspointState {
  [name: string]: CrosspointList;
}
