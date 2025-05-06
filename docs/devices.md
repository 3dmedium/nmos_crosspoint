# Device Specific Docs

This is a list for known issues or device specific implementations, working arround issues or adding specific features.

## Matrox 
### Matrox Convert IP (General)

Device implementation available. Specific features like EDID and scaling is implemented.

In SDP files sometimes there is "UNSPECIFIED" for color space or transfer curve. This leads to problems for some receivers.
Therefore a fix for bad SDP files is added, one can enable this in `config.json` with `"fixSdpBugs":true`.
UNSPECIFIED is then replacced by SDR or BT709.

After a resolution in the SDI or HDMI Signal changes, the change is first given to the Regsitry. After some time the SDP file in the device will be updated. In some cases the update of the SDP file and reconnection is done before the Convert IP was up to date. Therefore the SDP files are pushed twice (delay of some seconds) after changes. 


## Blackmagic

### Blackmagic 2110 IP Mini BiDirect 12G

The bidirectional devices can not receive their own flows. A normal ethernet switch will not send back flows. Therefore a connected device needs a loopback mode for this. Seems to be not implemented.

Extremely instable NMOS implementation. Some API calls lead to crashes. Reason for this needs to be analyzed.
Making connections between Blackmagic devices is just fine.

- After bad API requests most of the times SDP files can not be downloaded. So no further connections are possible.
- Senders do not get a active state most of the times.
- Activate a sender via API request crashes the NMOS api.
- A lot of ECONNRESET responses for successful API requests (connection was successful).
- Does not support UNSPECIFIED for color space or transfer system in SDP file.
- Can not receive its own flows. (Loopback missing)
- Registration to NMOS Registry is not stable.


## Imageine

### Selenio Network Processor
The default NMOS Labels are rewritten for simplicity.


