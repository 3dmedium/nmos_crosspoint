# NMOS Crosspoint

This tool is intended for demonstrating and testing the NMOS Api. As of now there is no intention for production use.

## Dependencies

This tool needs a working NMOS Registry running in the network. We test against [nmos-cpp](https://github.com/sony/nmos-cpp) in a docker container.

To get one up and running, you can use the one provided by rhastie: [https://github.com/rhastie/build-nmos-cpp](https://github.com/rhastie/build-nmos-cpp)

## Installation

The simplest way to get NMOS Crosspoint up and running is to use Docker Compose.

Make sure to change `docker-compose.yml` for your environment.
```shell
docker-compose up
```
This will create and start one Docker Container with a node express server.
Just point your Browser to the IP of the created Docker Container at port 80

## Network

NMOS Crosspoint can find and use multiple Registries, over all attached Networks. Usually i test in a environment with the following Networks:
- OOB (Out of Band Management Network)
- Amber (Main Media Network)
- Blue (Backup Media Network)

NMOS Crosspoint can be connected to even more Networks and will try to reach devices over multiple interfaces if they provide multiple endpoints to the registry.
In theory one should be able to get a complete failover. 

Unfortunately some devices do not present their NMOS Api on all interfaces. So for best compatibility NMOS Crosspoint and the Api should be present in all Networks.


## In Progress and ToDos

NMOS Crosspoint is created by testing devices. It does not completely follow the Standars due to some compatibility issues.

- Detecting multiple Endpoints for single NMOS Node with multiple Registries
- IS-07 (Connecting WebSocket Data Streams is alredy working with easy-nmos-node)
- IS-08 
- Performance of UI (Browser gets unresponsive sometimes)

## Static NMOS Registry Configurtation

If there is no working mDNS or the Registry is behind a Router, one can add the Registry by config file: `./server/config/settings.json`

Example:
```json
{
    "staticNmosRegistries":[
        {"ip":"10.1.0.2", "port":80, "priority":1000, "domain":""}
    ]
}
```

## Development

```
docker-compose up nmos-crosspoint-dev
```
Will start one Docker Container with an Angular Development Server and a Node Server. Both are live updating on changed files.

Coding was made Quick and Dirty and is keept like this while testing new functions.

## License

Copyright (C) 2021 Johannes Grieb (info@3dmedium.de)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License Version 3 as 
published by the Free Software Foundation.