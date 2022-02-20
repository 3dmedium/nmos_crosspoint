/* 
    NMOS Crosspoint
    Copyright (C) 2021 Johannes Grieb (info@3dmedium.de)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License Version 3
    as published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. 
*/

import { Component, OnInit } from '@angular/core';
import { CrosspointService, CrosspointState } from './crosspoint.service';

import { MatDialog } from '@angular/material/dialog';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Inject } from '@angular/core';

interface ConnectionError {
  sender_id: string;
  message: string;
}

interface Settings {
  showVideo: boolean;
  showAudio: boolean;
  showDataRtp: boolean;
  showDataWs: boolean;
  showLog: boolean;
  autoTake: boolean;
  showHidden: boolean;
}
@Component({
  selector: 'app-crosspoint',
  templateUrl: './crosspoint.component.html',
})
export class CrosspointComponent implements OnInit {
  constructor(
    private crosspointService: CrosspointService,
    public dialog: MatDialog
  ) {
    this.crosspointService.state.subscribe((s) => {
      this.state = s;
      this.updateViewState();
    });

    this.crosspointService.hidden.subscribe((s) => {
      this.hidden = s;
      this.updateViewState();
    });

    this.crosspointService.aliases.subscribe((s) => {
      this.aliases = s;
      this.updateViewState();
    });
    this.loadSettings();
  }

  showSettings = false;
  showLog = false;
  showConnection = false;

  state: CrosspointState = {
    devices: {},
    sources: {},
    senders: {},
    receivers: {},
    flows: {},
    nodes: {},
  };

  private aliases: any = {
    device: {},
    sender: {},
    receiver: {},
  };

  private hidden: any = {
    sender_device: {},
    receiver_device: {},
    sender: {},
    receiver: {},
  };

  public viewState: any = {
    senders: [],
    receivers: [],
  };

  sortRule: 'name' = 'name';

  updateViewStateAsync() {
    setTimeout(() => {
      this.updateViewState();
    }, 100);
  }
  updateViewState() {
    this.viewState = {
      senders: this.getSenderDevices(),
      receivers: this.getReceiverDevices(),
    };
  }

  ngOnInit(): void {}

  isHidden(id: string, type: string) {
    if (this.hidden[type][id]) {
      return true;
    } else {
      return false;
    }
  }

  getAlias(id: string, label: string, type: string) {
    if (this.aliases[type][id]) {
      return this.aliases[type][id];
    } else {
      return label;
    }
  }

  getSenderDevices() {
    const list: any[] = [];
    for (let dev of Object.values(this.state.devices)) {
      if ((dev as any).senders.length) {
        let listDevice: any = {
          id: dev.id,
          alias: this.getAlias(dev.id, dev.label, 'device'),
          label: dev.label,
          childs: [],
          hidden: false,
          expanded: false,
        };
        if (this.isHidden(dev.id, 'sender_device')) {
          if (this.settings.showHidden) {
            listDevice.hidden = true;
          } else {
            //cancel device
            continue;
          }
        }

        if (this.isExpanded(dev.id, 'snd')) {
          listDevice.expanded = true;
          (dev as any).senders.forEach((snd: any) => {
            if (this.state.senders[snd]) {
              if (this.isHidden(snd, 'sender')) {
                if (this.settings.showHidden) {
                  let alias = 'Unknown Sender';
                  if (this.state.senders[snd]) {
                    alias = this.getAlias(
                      snd,
                      this.state.senders[snd].label,
                      'sender'
                    );
                  }
                  listDevice.childs.push({
                    id: snd,
                    label: this.state.senders[snd].label,
                    alias: alias,
                    class: this.getSenderClass(snd),
                    info: this.getSenderInfo(snd),
                    hidden: true,
                  });
                }
              } else {
                let alias = 'Unknown Sender';
                if (this.state.senders[snd]) {
                  alias = this.getAlias(
                    snd,
                    this.state.senders[snd].label,
                    'sender'
                  );
                }
                listDevice.childs.push({
                  id: snd,
                  label: this.state.senders[snd].label,
                  alias: alias,
                  class: this.getSenderClass(snd),
                  info: this.getSenderInfo(snd),
                  hidden: false,
                });
              }
            }
          });

          listDevice.childs.sort((a: any, b: any) => {
            if (a.class != b.class) {
              if (a.class == 'video') {
                return -1;
              }
              if (b.class == 'video') {
                return 1;
              }
              if (a.class == 'audio') {
                return -1;
              }
              if (b.class == 'audio') {
                return 1;
              }
            } else {
              let compare = a.alias.localeCompare(b.alias);
              if (compare == 0) {
                compare = a.id.localeCompare(b.id);
              }
              return compare;
            }
          });
        }
        list.push(listDevice);
      }
    }
    list.sort((a: any, b: any) => {
      let compare = a.alias.localeCompare(b.alias);
      if (compare == 0) {
        compare = a.id.localeCompare(b.id);
      }
      return compare;
    });
    return list;
  }

  getReceiverDevices() {
    const list: any[] = [];
    for (let dev of Object.values(this.state.devices)) {
      if ((dev as any).receivers.length) {
        let listDevice: any = {
          id: dev.id,
          alias: this.getAlias(dev.id, dev.label, 'device'),
          label: dev.label,
          childs: [],
          hidden: false,
          expanded: false,
        };
        if (this.isHidden(dev.id, 'receiver_device')) {
          if (this.settings.showHidden) {
            listDevice.hidden = true;
          } else {
            //cancel device
            continue;
          }
        }
        if (this.isExpanded(dev.id, 'rcv')) {
          listDevice.expanded = true;
          (dev as any).receivers.forEach((rcv: any) => {
            if (this.state.receivers[rcv]) {
              if (this.isHidden(rcv, 'receiver')) {
                if (this.settings.showHidden) {
                  let alias = 'Unknown Receiver';
                  if (this.state.receivers[rcv]) {
                    alias = this.getAlias(
                      rcv,
                      this.state.receivers[rcv].label,
                      'receiver'
                    );
                  }
                  listDevice.childs.push({
                    id: rcv,
                    alias: alias,
                    label: this.state.receivers[rcv].label,
                    class: this.getReceiverClass(rcv),
                    info: this.getReceiverInfo(rcv),
                    hidden: true,
                  });
                }
              } else {
                let alias = 'Unknown Receiver';
                if (this.state.receivers[rcv]) {
                  alias = this.getAlias(
                    rcv,
                    this.state.receivers[rcv].label,
                    'receiver'
                  );
                }
                listDevice.childs.push({
                  id: rcv,
                  alias: alias,
                  label: this.state.receivers[rcv].label,
                  class: this.getReceiverClass(rcv),
                  info: this.getReceiverInfo(rcv),
                  hidden: false,
                });
              }
            }
          });
          listDevice.childs.sort((a: any, b: any) => {
            if (a.class != b.class) {
              if (a.class == 'video') {
                return -1;
              }
              if (b.class == 'video') {
                return 1;
              }
              if (a.class == 'audio') {
                return -1;
              }
              if (b.class == 'audio') {
                return 1;
              }
            } else {
              let compare = a.alias.localeCompare(b.alias);
              if (compare == 0) {
                compare = a.id.localeCompare(b.id);
              }
              return compare;
            }
          });
        }
        list.push(listDevice);
      }
    }
    list.sort((a: any, b: any) => {
      let compare = a.alias.localeCompare(b.alias);
      if (compare == 0) {
        compare = a.id.localeCompare(b.id);
      }
      return compare;
    });
    return list;
  }

  capabilitiesFit(receiverCap: any, flow: any) {
    if (!flow) {
      return false;
    }
    if (!receiverCap.media_types.includes(flow.media_type)) {
      return false;
    }
    if (receiverCap.transport != flow.transport) {
      return false;
    }
    return true;
  }

  connectErrors: { [name: string]: ConnectionError } = {};
  connectWaiting: any = {};
  connectNext: any = {};

  settings: Settings = {
    showVideo: true,
    showAudio: true,
    showDataRtp: true,
    showDataWs: true,
    showLog: false,
    autoTake: false,
    showHidden: true,
  };

  updateSettings() {
    setTimeout(() => {
      localStorage.setItem(
        'xpoint_filter_settings',
        JSON.stringify(this.settings)
      );
    }, 100);
  }
  loadSettings() {
    let s = localStorage.getItem('xpoint_filter_settings');
    if (s) {
      let o = JSON.parse(s as string);
      if (typeof o == 'object') {
        for (let k of Object.keys(o)) {
          if (this.settings.hasOwnProperty(k) && typeof o[k] == 'boolean') {
            (this.settings as any)[k] = o[k];
          }
        }
      }
    }

    let e = localStorage.getItem('xpoint_filter_expanded');
    if (e) {
      let o = JSON.parse(e as string);
      if (typeof o == 'object') {
        for (let k of Object.keys(o)) {
          if (typeof o[k] == 'boolean') {
            (this.expandedList as any)[k] = o[k];
          }
        }
      }
    }
  }

  hasState(receiverId: string, senderId: string): string {
    if (this.connectNext.hasOwnProperty(receiverId)) {
      if (this.connectNext[receiverId].sender_id == senderId) {
        return 'next';
      }
    }

    if (this.connectWaiting.hasOwnProperty(receiverId)) {
      if (this.connectWaiting[receiverId].sender_id == senderId) {
        return 'connecting';
      }
    }
    if (this.connectErrors.hasOwnProperty(receiverId)) {
      if (this.connectErrors[receiverId].sender_id == senderId) {
        return 'error';
      }
    }

    if (
      this.state.receivers[receiverId] &&
      this.state.receivers[receiverId].subscription.sender_id == senderId
    ) {
      return 'connected';
    }

    return 'ready';
  }

  makeConnection(receiverId: string, senderId: string, force = false) {
    if (this.settings.autoTake || force) {
      this.connectWaiting[receiverId] = { sender_id: senderId };
      // make Connection
      this.crosspointService
        .makeConnectApi(receiverId, senderId)
        .then((response: any) => {
          // clear waiting
          if (
            this.connectWaiting[receiverId] &&
            this.connectWaiting[receiverId].sender_id == senderId
          ) {
            delete this.connectWaiting[receiverId];
          }
          // clear errors
          if (this.connectErrors[receiverId]) {
            delete this.connectErrors[receiverId];
          }
        })
        .catch((response: any) => {
          // clear waiting
          if (
            this.connectWaiting[receiverId] &&
            this.connectWaiting[receiverId].sender_id == senderId
          ) {
            delete this.connectWaiting[receiverId];
          }
          // clear errors
          if (this.connectErrors[receiverId]) {
            delete this.connectErrors[receiverId];
          }

          if (response.message) {
            this.connectErrors[receiverId] = {
              message: response.message,
              sender_id: senderId,
            };
          } else {
            this.connectErrors[receiverId] = {
              message: 'Unknown Error',
              sender_id: senderId,
            };
          }
        });
    } else {
      if (this.connectNext.hasOwnProperty(receiverId)) {
        if (this.connectNext[receiverId].sender_id == senderId) {
          delete this.connectNext[receiverId];
          return;
        }
      }
      this.connectNext[receiverId] = { sender_id: senderId };
    }
  }

  makeNext() {
    for (let conn of Object.keys(this.connectNext)) {
      this.makeConnection(conn, this.connectNext[conn].sender_id, true);
    }
    this.connectNext = {};
  }

  disconnect(destinationType: 'device' | 'receiver', destinationId: string) {}

  expandedList: any = {};

  expand(type: string, id: string) {
    if (this.isExpanded(id, type)) {
      delete this.expandedList[type + '_' + id];
    } else {
      this.expandedList[type + '_' + id] = true;
    }

    localStorage.setItem(
      'xpoint_filter_expanded',
      JSON.stringify(this.expandedList)
    );
    this.updateViewState();
  }

  isExpanded(id: string, type: string) {
    return this.expandedList.hasOwnProperty(type + '_' + id);
  }

  getReceiverInfo(receiverId: string) {
    let info = '';
    try {
      let receiver = this.state.receivers[receiverId];
      if (
        receiver.subscription &&
        receiver.subscription.active &&
        receiver.subscription.sender_id
      ) {
        info = this.getSenderInfo(receiver.subscription.sender_id);
      }
    } catch (e) {}
    return info;
  }
  getSenderInfo(senderId: string) {
    let info = '';
    try {
      let sender = this.state.senders[senderId];
      let flow = this.state.flows[sender.flow_id];
      let source = this.state.sources[flow.source_id];
      switch (flow.format) {
        case 'urn:x-nmos:format:audio':
          info +=
            '' +
            source.channels.length +
            'Ch ' +
            flow.bit_depth +
            'bit ' +
            Math.floor(
              flow.sample_rate.numerator / flow.sample_rate.denominator / 1000
            ) +
            'kHz';
          break;
        case 'urn:x-nmos:format:video':
          let interlace =
            flow.interlace_mode == 'progressive'
              ? 'p'
              : flow.interlace_mode == 'interlaced_psf'
              ? 'psf'
              : 'i';
          info +=
            '' +
            flow.frame_height +
            interlace +
            Math.round(
              (flow.grain_rate.numerator / flow.grain_rate.denominator) * 100
            ) /
              100;
          info += ' ' + flow.colorspace + ' ' + flow.transfer_characteristic;
          break;
        case 'urn:x-nmos:format:data':
          if (flow.media_type == 'video/smpte291') {
            info += 'smpte291';
          }
          if (flow.media_type == 'application/json') {
            info += 'websocket';
          }
          break;
      }
    } catch (e) {}
    return info;
  }
  getSenderClass(senderId: string) {
    try {
      let flow = this.state.flows[this.state.senders[senderId].flow_id];
      // TODO detect disabled sender
      switch (flow.format) {
        case 'urn:x-nmos:format:audio':
          return 'audio';
        case 'urn:x-nmos:format:video':
          return 'video';
        case 'urn:x-nmos:format:data':
          return 'data';
      }
    } catch (e) {}
    return '';
  }

  getReceiverClass(receiverId: string) {
    try {
      let receiver = this.state.receivers[receiverId];
      // TODO detect disabled sender
      switch (receiver.format) {
        case 'urn:x-nmos:format:audio':
          return 'audio';
        case 'urn:x-nmos:format:video':
          return 'video';
        case 'urn:x-nmos:format:data':
          return 'data';
      }
    } catch (e) {}
    return '';
  }

  openSenderInfo(senderId: string) {
    this.crosspointService.getActiveApi(senderId).then((responses: any) => {
      let data: any = { senders: {}, receivers: {} };
      for (let r of responses) {
        if (r.status == 'fulfilled') {
          data[r.value.type][r.value.resource] = r.value.data;
        } else {
          // TODO error handling
          return;
        }
      }

      // all data gathered
      // show dialog
      const dialogRef = this.dialog.open(InformationDialog, {
        width: '80vw',
        height: '80vh',
        data: data,
      });
      dialogRef.afterClosed().subscribe((result) => {});
    });
  }
  openReceiverInfo(receiverId: string) {
    // TODO
    this.crosspointService.getActiveApi(receiverId).then((responses: any) => {
      let data: any = { senders: {}, receivers: {} };
      for (let r of responses) {
        if (r.status == 'fulfilled') {
          data[r.value.type][r.value.resource] = r.value.data;
        } else {
          // TODO error handling
          return;
        }
      }

      // all data gathered
      // show dialog
      const dialogRef = this.dialog.open(InformationDialog, {
        width: '80vw',
        height: '80vh',
        data: data,
      });
      dialogRef.afterClosed().subscribe((result) => {});
    });
  }

  openEditDialog(id: string, type: string, label: string) {
    let alias = '';
    if (this.aliases[type][id]) {
      alias = this.aliases[type][id];
    }

    const dialogRef = this.dialog.open(SettingsDialog, {
      data: {
        id: id,
        type: type,
        label: label,
        alias: alias,
      },
    });
    dialogRef.afterClosed().subscribe((data) => {
      if (typeof data.alias == 'string') {
        this.crosspointService
          .post('stateAddAlias', {
            id: data.id,
            type: data.type,
            alias: data.alias,
          })
          .then((response: any) => {})
          .catch((response: any) => {});
      }
    });
  }

  toggleHiddenObject(id: string, type: string) {
    this.crosspointService
      .post('stateToggleHidden', { id, type })
      .then((response: any) => {})
      .catch((response: any) => {});
  }
}

@Component({
  selector: 'crosspoint-information-dialog',
  templateUrl: 'crosspoint-information-dialog.html',
})
export class InformationDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}

@Component({
  selector: 'crosspoint-settings-dialog',
  templateUrl: 'crosspoint-settings-dialog.html',
})
export class SettingsDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}
