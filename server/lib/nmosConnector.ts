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

import * as WebSocket from "ws";
import axios from "axios";
import { SyncObject } from "./syncObject";
import { Subject } from "rxjs";
import { SyncLog } from "./syncLog";

const fs = require("fs");

//import {mDNS} from "multicast-dns";
//import mDNS = require("multicast-dns");

const mdns = require("multicast-dns")();

export class NmosRegistryConnector {
    public syncNmos: SyncObject;
    public syncConnectionState: SyncObject;

    constructor() {
        this.syncNmos = new SyncObject("nmos");
        this.syncConnectionState = new SyncObject("connectionState");

        let settings: any = { staticNmosRegistries: [] };
        try {
            let rawFile = fs.readFileSync("./config/settings.json");
            settings = JSON.parse(rawFile);
        } catch (e) {}

        try {
            settings.staticNmosRegistries.forEach((staticRegistry) => {
                let registry: NmosRegistry = {
                    ip: staticRegistry.ip,
                    port: staticRegistry.port,
                    priority: staticRegistry.priority,
                    source: "static",
                    domain: staticRegistry.domain,
                };
                this.addRegistry(registry);
            });
        } catch (e) {}

        this.mdnsQuery();
        this.mdnsQueryInterval = setInterval(() => {
            this.mdnsQuery();
        }, 12000);

        mdns.on("response", (response) => {
            response.answers.forEach((answer) => {
                if (answer.name == "_nmos-registration._tcp.local") {
                    let registry: NmosRegistry = { ip: "0.0.0.0", port: 0, priority: 1000, source: "mdns", domain: "" };
                    response.additionals.forEach((element) => {
                        if (element.type == "A") {
                            registry.ip = element.data;
                        }
                        if (element.type == "SRV") {
                            registry.port = element.data.port;
                            registry.domain = element.data.target;
                        }
                    });
                    if (registry.port != 0 && registry.ip != "0.0.0.0") {
                        this.addRegistry(registry);
                    }
                }
            });
        });
    }

    private mdnsQuery() {
        mdns.query({
            questions: [
                {
                    name: "_nmos-registration._tcp.local",
                    type: "PTR",
                    class: "IN",
                },
            ],
        });
    }
    private addRegistry(registry: NmosRegistry) {
        let addNew = true;
        let update = -1;

        for (let i = 0; i < this.nmosRegistryList.length; i++) {
            const el = this.nmosRegistryList[i];
            if (el.ip + ":" + el.port == registry.ip + ":" + registry.port) {
                addNew = false;
                if (el.source != "static") {
                    update = i;
                }
            }
        }

        if (addNew) {
            this.nmosRegistryList.push(registry);
            this.connectRegistry(registry);
        }

        if (update != -1) {
            this.nmosRegistryList[update] = registry;
        }

        this.updateSyncConnectionState();
    }
    connectRegistry(registry: NmosRegistry) {
        // TODO: disconnects and reconnects

        const url = "http://" + registry.ip + ":" + registry.port + "";
        this.getSubscription(url, "/nodes");
        this.getSubscription(url, "/devices");
        this.getSubscription(url, "/sources");
        this.getSubscription(url, "/senders");
        this.getSubscription(url, "/receivers");
        this.getSubscription(url, "/flows");
    }

    private mdnsQueryInterval = null;
    private mdnsBrowser: any = null;
    private version = "v1.2";
    private connectVersionList = ["v1.1", "v1.0"];
    private nmosRegistryList: NmosRegistry[] = [];

    private state = {
        devices: {},
        sources: {},
        senders: {},
        receivers: {},
        flows: {},
        nodes: {},
    };
    private connections = {};

    private getSubscription(nmosRegistryUrl: string, resource: string) {
        axios
            .post(nmosRegistryUrl + "/x-nmos/query/" + this.version + "/subscriptions", {
                resource_path: resource,
                params: {},
                persist: false,
                max_update_rate_ms: 100,
            })

            .then((response: any) => {
                let subscription = response.data;
                let fullResource = nmosRegistryUrl + resource;
                if (this.connections[fullResource]) {
                    this.connections[fullResource].ws.close();
                }
                this.connections[fullResource] = {
                    subscription,
                    ws: new WebSocket(subscription.ws_href),
                };
                this.connections[fullResource].ws.onmessage = (message) => {
                    this.updateState(JSON.parse(message.data));
                };
                this.connections[fullResource].ws.onclose = () => {
                    this.updateSyncConnectionState();
                };
                this.connections[fullResource].ws.onopen = () => {
                    this.updateSyncConnectionState();
                };
            })
            .catch((error) => {
                SyncLog.log("error", "Error While creating NMOS Subscription on Registry: " + nmosRegistryUrl, "httpRequest", error);
            });
    }
    private updateState(message: any) {
        let type = "";
        try {
            type = (message.grain.topic as string).split("/").join("");
        } catch (e) {}
        if (this.state[type]) {
            message.grain.data.forEach((g: any) => {
                if (g.hasOwnProperty("path") && typeof g.path == "string") {
                    if (g.hasOwnProperty("post")) {
                        // add or update element
                        if (typeof g.post == "object") {
                            this.state[type][g.path] = g.post;
                        }
                    } else {
                        // remove element
                        try {
                            delete this.state[type][g.path];
                        } catch (e) {}
                    }
                }
            });
        }
        this.syncNmos.setState(this.state);
    }

    updateSyncConnectionState() {
        let list = [];
        this.nmosRegistryList.forEach((registry) => {
            let entry = JSON.parse(JSON.stringify(registry));
            entry.connected = [];
            try {
                const url = "http://" + registry.ip + ":" + registry.port + "";
                let endpoints = ["nodes", "devices", "sources", "senders", "receivers", "flows"];
                endpoints.forEach((e) => {
                    if (this.connections[url + "/" + e]) {
                        if (this.connections[url + "/" + e].ws.readyState == WebSocket.OPEN) {
                            entry.connected.push(e);
                        }
                    }
                });
            } catch (e) {}
            list.push(entry);
        });
        this.syncConnectionState.setState({ registries: list });
    }

    makeConnection(receiverId: string, senderId: string) {
        return new Promise((resolve, reject) => {
            if (senderId == "disconnect") {
                this.prepareConnectionReceiverInformation(receiverId)
                    .then((receiverInformation: any) => {
                        //build PATCH

                        let interfaceCount = Math.min(this.state.receivers[receiverId].interface_bindings.length);
                        let params: any[] = [];

                        for (let i = 0; i < interfaceCount; i++) {
                            if (
                                this.state.receivers[receiverId].transport == "urn:x-nmos:transport:rtp.mcast" ||
                                this.state.receivers[receiverId].transport == "urn:x-nmos:transport:rtp"
                            ) {
                                params[i] = { rtp_enabled: false };
                            } else {
                                params[i] = {};
                            }
                        }

                        let patch: any = {
                            activation: { mode: "activate_immediate" },
                            master_enable: false,
                            transport_params: params,
                        };

                        let patchHref = receiverInformation.activeControlHref;
                        patchHref = patchHref.substring(0, patchHref.length - 6);
                        patchHref = patchHref + "staged";

                        axios
                            .patch(patchHref, patch)
                            .then((response) => {
                                resolve({
                                    message: "Disconnect was successfull",
                                });
                            })
                            .catch((error) => {
                                SyncLog.log("error", "NMOS Connection PATCH failed. (receiverId: " + receiverId + ", senderId: " + senderId + ")", "httpRequest", error);
                                reject({
                                    message: "Error while Patching..",
                                    sender_id: senderId,
                                });
                            });
                    })
                    .catch((e) => {
                        reject(e);
                    });
            } else {
                if (
                    !(
                        this.state.senders[senderId].transport == this.state.receivers[receiverId].transport ||
                        (this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp" && this.state.receivers[receiverId].transport == "urn:x-nmos:transport:rtp.mcast") ||
                        (this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp.mcast" && this.state.receivers[receiverId].transport == "urn:x-nmos:transport:rtp")
                    )
                ) {
                    reject({
                        message: "Mismatching Flow Types (Websocket / RTP)",
                        receiverId,
                        senderId,
                    });
                    return;
                }

                this.prepareConnectionSenderInformation(senderId)
                    .then((senderInformation: any) => {
                        this.prepareConnectionReceiverInformation(receiverId)
                            .then((receiverInformation: any) => {
                                //build PATCH

                                let interfaceCount = Math.min(this.state.senders[senderId].interface_bindings.length, this.state.receivers[receiverId].interface_bindings.length);
                                let params: any[] = [];

                                let i = 0;

                                for (i = 0; i < interfaceCount; i++) {
                                    params[i] = {};
                                    if (
                                        this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp.mcast" ||
                                        this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp"
                                    ) {
                                        //params[i] = data.senders.active.transport_params[i];
                                        params[i].interface_ip = "auto";
                                        params[i].rtp_enabled = true;
                                        //params[i].multicast_ip = data.senders.active.transport_params[i].destination_ip;
                                        //delete params[i].destination_ip;
                                    } else {
                                        params[i] = senderInformation.active.transport_params[i];
                                    }
                                }

                                interfaceCount = this.state.receivers[receiverId].interface_bindings.length;
                                for (i = i; i < interfaceCount; i++) {
                                    params[i] = {};
                                }

                                if (!senderInformation.active.master_enable) {
                                    reject({
                                        message: "Sender is not active.",
                                    });
                                    return;
                                }

                                let patch: any = {
                                    activation: { mode: "activate_immediate" },
                                    sender_id: senderId,
                                    transport_file: { data: null, type: null },
                                    transport_params: params,
                                };

                                if (
                                    this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp.mcast" ||
                                    this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp"
                                ) {
                                    patch.transport_file = {
                                        type: "application/sdp",
                                        data: senderInformation.transportfile,
                                    };
                                }

                                if (!receiverInformation.active.master_enable) {
                                    patch.master_enable = true;
                                }

                                let patchHref = receiverInformation.activeControlHref;
                                patchHref = patchHref.substring(0, patchHref.length - 6);
                                patchHref = patchHref + "staged";

                                axios
                                    .patch(patchHref, patch)
                                    .then((response) => {
                                        resolve({
                                            message: "Connection was successfull",
                                        });
                                    })
                                    .catch((error) => {
                                        SyncLog.log("error", "NMOS Connection PATCH failed. (receiverId: " + receiverId + ", senderId: " + senderId + ")", "httpRequest", error);
                                        reject({
                                            message: "Error while Patching..",
                                            sender_id: senderId,
                                        });
                                    });
                            })
                            .catch((e) => {
                                reject(e);
                            });
                    })
                    .catch((e) => {
                        reject(e);
                    });
            }
        });
    }

    prepareConnectionSenderInformation(senderId) {
        return new Promise((resolve, reject) => {
            //Prepare connection command from senderId

            // find device for sneder in state
            let deviceId = this.state.senders[senderId].device_id;
            if (!deviceId) {
                reject({
                    message: "Sender not found",
                });
                return;
            }

            let device = this.state.devices[deviceId];
            if (!deviceId) {
                reject({
                    message: "Sender device not found",
                });
                return;
            }
            let connectionControlList = [];
            let connectionControlFound = false;

            this.connectVersionList.forEach((version) => {
                if (!connectionControlFound) {
                    this.state.devices[deviceId].controls.forEach((control: any) => {
                        if (control.type == "urn:x-nmos:control:sr-ctrl/" + version) {
                            let href = control.href;
                            if (href[href.length - 1] != "/") {
                                href = href + "/";
                            }
                            href = href + "single/senders/" + senderId + "/active";
                            connectionControlList.push(href);
                            connectionControlFound = true;
                        }
                    });
                }
            });

            let manifestControlList = [];
            let manifestControlFound = false;
            // Manifest / Transport file is only available for Multicast / RTP
            if (this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp" || this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp.mcast") {
                this.connectVersionList.forEach((version) => {
                    if (!manifestControlFound) {
                        this.state.devices[deviceId].controls.forEach((control: any) => {
                            if (control.type == "urn:x-nmos:control:manifest-base/" + version) {
                                let href = control.href;
                                if (href[href.length - 1] != "/") {
                                    href = href + "/";
                                }
                                href = href + "senders/" + senderId + "/manifest";
                                manifestControlList.push(href);
                                manifestControlFound = true;
                            }
                        });
                    }
                });
            }
            this.getOne(connectionControlList)
                .then((connectionResponse: any) => {
                    // Manifest is only required if RTP / Multicast
                    if (this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp" || this.state.senders[senderId].transport == "urn:x-nmos:transport:rtp.mcast") {
                        if (manifestControlList.length == 0) {
                            manifestControlList.push(this.state.senders[senderId].manifest_href);
                        }
                        this.getOne(manifestControlList)
                            .then((manifestResponse: any) => {
                                // all information available for Patch

                                resolve({
                                    transportfile: manifestResponse.data,
                                    active: connectionResponse.data,
                                    activeControlHref: connectionResponse.config.url,
                                });
                            })
                            .catch((e) => {
                                if (e.errors.length == 0) {
                                    reject({
                                        message: "Sender Manifest Controls not available",
                                    });
                                } else {
                                    reject({
                                        message: "Sender Manifest Controls not reachable",
                                    });
                                }
                            });
                    } else {
                        resolve({
                            active: connectionResponse.data,
                            activeControlHref: connectionResponse.config.url,
                        });
                    }
                })
                .catch((e) => {
                    reject({
                        message: "Sender Active Controls not reachable",
                    });
                });
        });
    }

    prepareConnectionReceiverInformation(receiverId) {
        return new Promise((resolve, reject) => {
            //Prepare connection command from senderId

            // find device for sneder in state
            let deviceId = this.state.receivers[receiverId].device_id;
            if (!deviceId) {
                reject({
                    message: "Receiver not found",
                });
                return;
            }

            let device = this.state.devices[deviceId];
            if (!deviceId) {
                reject({
                    message: "Receiver device not found",
                });
                return;
            }
            let connectionControlList = [];
            let connectionControlFound = false;

            this.connectVersionList.forEach((version) => {
                if (!connectionControlFound) {
                    this.state.devices[deviceId].controls.forEach((control: any) => {
                        if (control.type == "urn:x-nmos:control:sr-ctrl/" + version) {
                            let href = control.href;
                            if (href[href.length - 1] != "/") {
                                href = href + "/";
                            }
                            href = href + "single/receivers/" + receiverId + "/active";
                            connectionControlList.push(href);
                            connectionControlFound = true;
                        }
                    });
                }
            });

            this.getOne(connectionControlList)
                .then((connectionResponse: any) => {
                    resolve({
                        active: connectionResponse.data,
                        activeControlHref: connectionResponse.config.url,
                    });
                })
                .catch((e) => {
                    reject({
                        message: "Receiver Active Controls not reachable",
                    });
                });
        });
    }

    private getOne(hrefList: string[]) {
        return new Promise((resolve, reject) => {
            let promises = [];
            hrefList.forEach((href) => {
                promises.push(axios.get(href));
            });
            Promise.any(promises)
                .then((response) => {
                    resolve(response);
                })
                .catch((error) => {
                    // Logging
                    reject(error);
                });
        });
    }
}

interface Connection {
    subscription: any;
    ws: WebSocket;
}

interface NmosRegistry {
    ip: string;
    port: number;
    domain: string;
    priority: number;
    source: "mdns" | "static";
}

interface ConnectionList {
    [name: string]: Connection;
}

interface CrosspointList {
    [name: string]: any;
}
export interface CrosspointState {
    [name: string]: CrosspointList;
}
