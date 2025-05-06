# Standalone operation

## Linux systemd service example

```
[Unit]
Description=nmos_crosspoint
Documentation=https://github.com/3dmedium/nmos_crosspoint
After=network.target

[Service]
Type=simple
User=nmos

WorkingDirectory=/opt/nmos_crosspoint/server
ExecStart=/usr/bin/node /opt/nmos_crosspoint/server/dist/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```