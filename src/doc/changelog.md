## v0.3.3

- Fix bugs in firefox and with the data received
- Improve stability

## v0.3.2

- Moved to use a [new
  implementation](https://github.com/wirecloud-fiware/kurento-example-services-scala)
  of the service
- Updated the default server URL using https
- New widget name: kurento-crowddetector. The previous widget name was: crowddetector.

## v0.3.1

- Added two endpoints that send data of the polygons to a Google Graph


## v0.3.0

### General

- Initial documentation.
- Transition between local stream and kurento stream is transparent.
- Spinner added when any video or streaming are loading.
- When the crowddetector filter stream starts, the unfinished paths will be deleted.


### Multiple Polygons

- Initial version of multiple polygons support.
- "Edit" and "Not edit" modes.
- Change to "Not edit" mode is only possible if you have at least one finished polygon.
- After the first polygon is finished, if don't do anything, after 5 seconds the crowddetector filter stream will start.
- You can force the crowddetector filter stream if you are in "Edit" mode and go to "Not edit" mode.
- Undo and redo capabilities. Only work in "Edit" mode. Can be triggered with Ctrl-Z and Ctrl-Shift-Z (Undo and Redo).
- After the first crowddetector filter stream you can modify the polygons again (activating "Edit" mode) and restart the crowddetector filter stream with the new polygons.
- All the polygons are removed when change of input (webcam to video or backwards and between videos)
- You can drag the vertex to resize the polygons if you are in "Edit" mode. The polygon doesn't need to be finished to drag the vertex.


### Settings

- Any setting can be changed in any moment and the widget will reload as needed.
- New options:
    - Checkbox to select if use the local webcam or a remote video (Default: true [camera activate])
    - Text box where you can write a remote video URL or a video path in the server. (Default: videos/6.mp4') <br/>
    The path in the server can be absolute (file://) or relative.<br/>
    Only used if the camera checkbox is unchecked


### Testing

- Testing support.
- Basic initial tests.
- In order to let the test program have access to the private functions you can add the exports in a block.
