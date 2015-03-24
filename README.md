Kurento One2One widget
======================

The kurento CrowdDetector widget is a WireCloud widget that provides an easy way for use a video and detect people in the areas selected in your dashboard.

This CrowdDetector widget need a server running as middleware between you and a kurento media server.

The server is this [crowddetector service](https://github.com/wirecloud-fiware/kurento-example-services/tree/develop/kurento-crowddetector) provided by FiWare.

Latest version of this widget is always [provided in FIWARE lab](https://store.lab.fiware.org/search/keyword/CrowdDetector) where you can make use of it on the [Mashup portal](https://mashup.lab.fiware.org/)

Build
-----

Be sure to have installed [Node.js](http://node.js) and [Bower](http://bower.io)
in your system. For example, you can install it on Ubunutu and Debian running the
following commands:

```bash
curl -sL https://deb.nodesource.com/setup | sudo bash -
sudo apt-get install nodejs
sudo apt-get install npm
sudo npm install -g bower
```

If you want the last version of the widget, you should change to the `develop` branch:

```bash
git checkout develop
```

Install other npm dependencies by running: (need root because some libraries use applications, check package.json before to be sure)

```bash
sudo npm install
```

For build the widget you need download grunt:

```bash
sudo npm install -g grunt-cli
```

And now, you can use grunt:

```bash
grunt
```

If everything goes well, you will find a wgt file in the `dist` folder.

## Settings

- **Server URL** - URL of the crowddetector server. - Default: `ws://130.206.81.33:8082/crowddetector`
- **User Camera** - If checked the widget will use the local webcam, if not will use a remote video. - Default: `true`
- **File Path** - The remote URL or path in the server (absolute with file:// or relative) to load when **User Camera** is unchecked. - Default: `videos/6.mp4`

## Wiring

### Input Endpoints

**None**

### Output Endpoints

- **CrowdDetector Fluidity Output** - Type :: `JSON (in String)`. Send the fluidity data of all the Region Of Interest drawed periodically if there are changes to a Google Graph widget that is installed in with the [ChartsStarterKit](https://store.lab.fiware.org/offering/CoNWeT/ChartsStarterKit/1.0)
- **CrowdDetector Occupancy Output** - Type :: `JSON (in String)`. Send the occupancy data of all the Region Of Interest drawed periodically if there are changes to a Google Graph widget that is installed in with the [ChartsStarterKit](https://store.lab.fiware.org/offering/CoNWeT/ChartsStarterKit/1.0)

## Usage

### Use a remote video.

You have to uncheck the **User Camera** setting and set in the **File Path** setting the video you want.

The video path can be a remote video (`http://...`) or a video name available on the server (See [service documentation](https://github.com/wirecloud-fiware/kurento-example-services/tree/develop/kurento-crowddetector) for more details about how to load video).

### Set polygons to detect.

When you have a video (or local webcam) loaded, the mode will be setted to `Editing` and will be green.

Once you can edit, when you click you will set a vertex and will add an edge with the previous vertex (if exists).

When you want to finish a polygon you can do a double-click (will add a vertex and finish with that) or click the first vertex of the polygon.

You can add all the polygons you want.

### Send the video with the polygons to detect.

Once you've finish at least one polygon, you have to ways to send the polygons to the server and start detecting.

1. Press the `Editing` button to stop the edit.
2. Wait 5 seconds without add or drag any vertex.

## Reference

- [Widget Source Code](https://github.com/wirecloud-fiware/kurento-crowddetector-widget/tree/develop)
- [Server Source Code](https://github.com/wirecloud-fiware/kurento-example-services/tree/develop/kurento-crowddetector)
- [FIWARE Mashup](https://mashup.lab.fiware.org/)

## Copyright and License

Copyright 2015 CoNWeT Lab., Universidad Politecnica de Madrid

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
