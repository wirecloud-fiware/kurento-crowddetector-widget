/*global $, kurentoUtils, MashupPlatform, jsPlumb*/
/*exported CrowdDetector*/
var CrowdDetector = (function () {
    "use strict";

    // attach the .equals method to Array's prototype to call it on any array
    Array.prototype.equals = function (array) {
        // if the other array is a falsy value, return
        if (!array) {
            return false;
        }

        // compare lengths - can save a lot of time
        if (this.length != array.length) {
            return false;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            // Check if we have nested arrays
            if (this[i] instanceof Array && array[i] instanceof Array) {
                // recurse into the nested arrays
                if (!this[i].equals(array[i])) {
                    return false;
                }
            } else if (this[i] != array[i]) {
                // Warning - two different object instances will never be equal: {x:20} != {x:20}
                return false;
            }
        }
        return true;
    };

    /*********************************************************
     ************************CONSTANTS*************************
     *********************************************************/

    var I_CAN_START = 0,
        I_CAN_STOP = 1,
        I_AM_STARTING = 2,
        I_AM_WITH_VIDEO = 3;
    var ADD = "Add",
        MOVE = "Move",
        FINISH = "Finish";

    var dot_endp = {
        endpoint: "Dot",
        cssClass: "endpoint",
        anchor: [0.5, 0.5, 0, -1],
        endpointsOnTop: false,
        isTarget: true,
        isSource: true,
        maxConnections: 4
    };

    /*********************************************************
     ************************VARIABLES*************************
     *********************************************************/
    var canvas, count, points, actual, timer, actions, redos, redding, dragging, can_edit, instance, wss,
        webRtcPeer, webRtcVideo, stream, state, videoInput, videoOutput, prevDetection, url, spinner;
    var clear, undo_btn, redo_btn, edit_btn;

    var camera, file_path;

    var sendMessage, clearDots, redraw, recalculate, crowdDetectorDirection, crowdDetectorFluidity, crowdDetectorOccupancy,
        start, startResponse, setState, setWebSocketEvents, onOffer, onError, stop, connect;

    var _stopDrag, redo_action, undo_action, handle_edit, handler, handler_dbl, keyHandler;

    var getClickPosition;

    var occupancy, fluidity, o_occupancy, o_fluidity, oc_last_8, fl_last_8, oc_send, fl_send;

    var sdp_offer;

    /********************************************************/
    /**********************CONSTRUCTOR***********************/
    /********************************************************/

    var CrowdDetector = function CrowdDetector () {
        jsPlumb.ready(function () {
            instance = clean_instance();
        });

        canvas = document.getElementById("myCanvas");
        spinner = $("#spinner");

        clear = document.getElementById('clear');
        undo_btn = document.getElementById('undo');
        redo_btn = document.getElementById('redo');
        edit_btn = document.getElementById('toggle-edit');

        count = [0];
        points = [[]];
        actual = 0;
        actions = [];
        redos = [];

        occupancy = [];
        fluidity = [];
        o_occupancy = [];
        o_fluidity = [];
        oc_last_8 = [];
        fl_last_8 = [];
        fl_send = false;
        oc_send = false;

        sdp_offer = '';

        timer = 0;

        webRtcVideo = null;
        stream = null;

        redding = false;
        dragging = false;
        can_edit = false;
        url = null;
        camera = null;
        file_path = null;
        wss = null;
        videoInput = document.getElementById('videoInput');
        videoOutput = document.getElementById('videoOutput');
        prevDetection = false;
        setState(I_CAN_START);

        // Events
        if (videoOutput) {
            videoOutput.addEventListener('canplay', function () {
                videoOutput.className = "";
                videoInput.className = "hide";
            }, false);
        }
        if (videoInput) {
            videoInput.addEventListener('canplay', function () {
                videoOutput.className = "hide";
                videoInput.className = "";
                if (state === I_CAN_STOP) {
                    showPath();
                }
                window.setTimeout(function () {
                    recalculate();
                    if (state === I_CAN_START || state === I_AM_WITH_VIDEO) {
                        start_edit();
                    }
                }, 2000);
            });
        }
        if (canvas) {
            canvas.addEventListener("click", handler, false);
            canvas.addEventListener("dblclick", handler_dbl, false);
        }
        if (clear) {
            clear.addEventListener("click", clearDots, false);
        }
        if (undo_btn && redo_btn && edit_btn) {
            undo_btn.addEventListener("click", undo_action, false);
            redo_btn.addEventListener("click", redo_action, false);
            edit_btn.addEventListener("click", handle_edit);
        }

        document.onkeydown = keyHandler;

        window.addEventListener("load", recalculate, false);
        window.addEventListener("resize", recalculate, false);

        if (MashupPlatform) {
            loadPreferences();

            //
            // MashupPlatform.wiring.registerCallback('activate_detection', function (data) {
            //     loadVideo();
            // });

            // Register preference callback
            MashupPlatform.prefs.registerCallback(function () {
                loadPreferences();
            });
        }

        window.setInterval(send_all_wiring, 1000);

        // // Connect to server url
        connect_all(url);
    };


    /*********************************************************
     **************************PRIVATE*************************
     *********************************************************/

    var loadPreferences = function () {
        var o_url = url,
            o_camera = camera,
            o_path = file_path;
        url = MashupPlatform.prefs.get('server-url');
        camera = MashupPlatform.prefs.get('use-camera');
        file_path = MashupPlatform.prefs.get('file-path');

        if (o_url && url !== o_url) {
            connect_all(url);
        }
        if (o_camera !== null && camera !== o_camera) {
            stop_all();
            if (o_camera && stream) {
                stream.stop();
                videoInput.src = null;
                videoOutput.src = null;
            }
            clearDots();
            connect_all(url);
            loadVideo();
        }
        if (o_path && o_path !== file_path && !camera) {
            stop_all();
            clearDots();
            connect_all(url);
            loadVideo();
        }
    };

    var connect_all = function (url, c) {
        if (camera) {
            connect(url, setWebSocketEvents);
        } else {
            connect(url, setWebSocketVideoEvents);
        }
    };

    connect = function connect(url, events) {
        if (wss !== null) {
            wss.close();
        }

        wss = new WebSocket(url);
        events();
        window.onbeforeunload = function () {
            if (wss !== null) {
                wss.close();
            }
        };
    };

    var send_wiring = function send_wiring (name, data) {
        MashupPlatform.wiring.pushEvent(name, JSON.stringify(data));
    };

    var setWebSocketVideoEvents = function setWebSocketVideoEvents () {
        wss.onopen = function () {
            loadVideo();
        };
        wss.onmessage = function (message) {
            var parsedMessage = JSON.parse(message.data);
            switch (parsedMessage.id) {
            case 'getVideo':
                startVideo(parsedMessage);
                break;
            case 'crowdDetectorDirection':
                crowdDetectorDirection(parsedMessage);
                break;
            case 'crowdDetectorFluidity':
                crowdDetectorFluidity(parsedMessage);
                break;
            case 'crowdDetectorOccupancy':
                crowdDetectorOccupancy(parsedMessage);
                break;
            case 'error':
                if (state == I_AM_STARTING) {
                    setState(I_CAN_START);
                }
                onError("Error message from server: " + parsedMessage.message);
                break;
            default:
                if (state == I_AM_STARTING) {
                    setState(I_CAN_START);
                }
                onError('Unrecognized message', parsedMessage);
            }
        };

        wss.onerror = function () {
            onError("Error creating websocket");
        };
    };


    setWebSocketEvents = function setWebSocketEvents () {
        wss.onopen = function () {
            MashupPlatform.widget.log("WebSocket connected.", MashupPlatform.log.INFO);
            loadVideo();
        };

        wss.onmessage = function (message) {
            var parsedMessage = JSON.parse(message.data);
            // MashupPlatform.widget.log('Received message: ' + message.data, MashupPlatform.log.INFO);

            switch (parsedMessage.id) {
            case 'startResponse':
                startResponse(parsedMessage);
                break;
            case 'crowdDetectorDirection':
                crowdDetectorDirection(parsedMessage);
                break;
            case 'crowdDetectorFluidity':
                crowdDetectorFluidity(parsedMessage);
                break;
            case 'crowdDetectorOccupancy':
                crowdDetectorOccupancy(parsedMessage);
                break;
            case 'error':
                if (state == I_AM_STARTING) {
                    setState(I_CAN_START);
                }
                onError("Error message from server: " + parsedMessage.message);
                break;
            default:
                if (state == I_AM_STARTING) {
                    setState(I_CAN_START);
                }
                onError('Unrecognized message', parsedMessage);
            }
        };
        wss.onerror = function () {
            onError("Error creating WebSocket");
        };
    };

    var loadVideo = function loadVideo () {
        // cleanVideo();
        showSpinner(videoInput, videoOutput);
        if (camera) {
            activateCamera();
        } else {
            activateVideo();
        }
    };

    var activateVideo = function activateVideo () {
        if (!webRtcVideo) {
            webRtcVideo = kurentoUtils.WebRtcPeer.startRecvOnly(videoInput, function (offerSdp) {
                sdp_offer = offerSdp;
                var message = {
                    id: 'getVideo',
                    sdpOffer: offerSdp,
                    url:  file_path,
                    filter: false,
                    dots: []
                };
                sendMessage(message);
            }, onError);
        }
    };

    var activateCamera = function activateCamera () {
        navigator.getMedia = (navigator.getUserMedia ||
                              navigator.webkitGetUserMedia ||
                              navigator.mozGetUserMedia ||
                              navigator.msGetUserMedia);
        if (!navigator.getMedia) {
            return;
        }
        navigator.getMedia (

            // constraints
            {
                video: true,
                audio: false
            },

            // successCallback
            function (localMediaStream) {
                stream = localMediaStream;
                if (navigator.mozGetUserMedia) {
                    videoInput.mozSrcObject = localMediaStream;
                } else {
                    var vendorURL = window.URL || window.webkitURL;
                    videoInput.src = vendorURL.createObjectURL(localMediaStream);
                }
            },

            // errorCallback
            function (err) {
                window.console.error("Ocurrió el siguiente error: " + err.name);
                onError("Error trying to activate the webcam.");
            });
    };

    sendMessage = function sendMessage (message) {
        if (typeof wss !== 'undefined' && wss !== null) {
            var jsonMessage = JSON.stringify(message);
            window.console.log('Sending message: ' + jsonMessage);
            wss.send(jsonMessage);
        }
    };

    clearDots = function clearDots () {
        occupancy = [];
        fluidity = [];
        oc_send = false;
        fl_send = false;

        count = [0];
        points = [[]];
        actual = 0;
        instance.reset();
        $("#myCanvas .circle").remove();
        $("#myCanvas .circlenoedit").remove();
        instance = clean_instance();
    };

    redraw = function redraw (canvasPrev) {
        if (instance) {
            instance.repaintEverything();
        }
    };

    recalculate = function recalculate() {
        videoInput.style.height = (window.innerHeight - 51) + 'px';
        videoOutput.style.height = (window.innerHeight - 51) + 'px';

        var video = (videoInput.className === "") ? videoInput : videoOutput;

        var videoWidth = video.videoWidth,
            videoHeight = video.videoHeight,
            clientWidth = video.clientWidth,
            clientHeight = video.clientHeight,
            videoRatio = videoWidth / videoHeight,
            windowRatio = window.innerWidth / window.innerHeight;

        canvas.style.left = 0 + 'px';
        canvas.style.top = 51 + 'px';
        // FORMULA: original height / original width x new width = new height
        // FORMULA: new width = new height * original width / originalheight

        if (windowRatio > videoRatio) {
            var canvasWidth = videoWidth * (clientHeight / videoHeight);
            canvas.style.width = canvasWidth;
            canvas.style.height = window.innerHeight - 51;
            canvas.style.left = ((clientWidth - canvasWidth) / 2) + 'px';
        } else {
            var canvasHeight = videoHeight * (clientWidth / videoWidth);
            canvas.style.width = window.innerWidth;
            canvas.style.height = canvasHeight;
            canvas.style.top = ((clientHeight - canvasHeight) / 2) + 51 + 'px';
        }

        redraw();
    };

    var create_chart_json = function create_chart_json (name, value) {
        var json = {
            'type': 'Gauge',
            'options': {
                'width': '100%',
                'height': '100%',
                'redFrom': '90',
                'redTo': '100',
                'yellowFrom': '75',
                'yellowTo': '90',
                'minorTicks': '5'
            },
            'data': [
                ['Label', 'Value']
            ]
        };
        var n_v = 0;  //Math.round(value * 10000) / 10000;
        for (var i = 0; i < value.length; i++) {
            n_v = Math.round(value[i] * 10000) / 10000;
            json.data.push([i.toString(), n_v]);
        }
        return json;
    };

    var send_all_wiring = function () {
        if (!fl_send || !fluidity.equals(o_fluidity)) {
            send_wiring('crowd_fluidity', create_chart_json('', fluidity));
            o_fluidity = fluidity.slice(0);
            fl_send = true;
        }
        if (!oc_send || !occupancy.equals(o_occupancy)) {
            send_wiring('crowd_occupancy', create_chart_json('', occupancy));
            o_occupancy = occupancy.slice(0);
            oc_send = true;
        }
    };

    // var add_max = function(arr, v, m) {
    //     if (arr.length() >= m) {
    //         arr.shift();
    //     }
    //     arr.push(v.slice(0));
    // };

    crowdDetectorDirection = function crowdDetectorDirection(message) {
        window.console.log ("Direction event received in roi " + message.event_data.roiID +
                            " with direction " + message.event_data.directionAngle);
    };

    crowdDetectorFluidity = function crowdDetectorFluidity(message) {
        window.console.log ("Fluidity event received in roi " + message.event_data.roiID +
                            ". Fluidity level " + message.event_data.fluidityPercentage +
                            " and fluidity percentage " + message.event_data.fluidityLevel);
        o_fluidity = fluidity.slice(0);
        var i = Number(message.event_data.roiID.replace('roi', ''));
        var val = message.event_data.fluidityPercentage;
        fluidity[i - 1] = (fl_send || val === 0) ? val : (val + fluidity[i - 1]) / 2;
        fl_send = false;
    };

    crowdDetectorOccupancy = function crowdDetectorOccupancy(message) {
        window.console.log ("Occupancy event received in roi " + message.event_data.roiID +
                            ". Occupancy level " + message.event_data.occupancyPercentage +
                            " and occupancy percentage " + message.event_data.occupancyLevel);
        o_occupancy = occupancy.slice(0);
        var i = Number(message.event_data.roiID.replace('roi', ''));
        var val =  message.event_data.occupancyPercentage;
        occupancy[i - 1] = (oc_send || val === 0) ? val : (val + occupancy[i - 1]) / 2;
        oc_send = false;
    };

    var hidePath = function hidePath () {
        $("#myCanvas").addClass("hide");
    };

    var showPath = function showPath () {
        $("#myCanvas").removeClass("hide");
    };

    var start_v = function start_v() {
        window.console.log("Starting remote video detecting");
        setState(I_AM_STARTING);

        stop();
        hidePath();

        webRtcVideo = kurentoUtils.WebRtcPeer.startRecvOnly(videoInput, function (offerSdp) {
            sdp_offer = offerSdp;
            var message = {
                id: 'getVideo',
                sdpOffer: offerSdp,
                url:  file_path,
                filter: true,
                dots: prepare_points_server()
            };
            sendMessage(message);
        }, onError);
    };

    start = function start() {
        window.console.log("Starting video crowd detector ...");
        // Disable start button
        setState(I_AM_STARTING);

        window.console.log("Creating WebRtcPeer and generating local sdp offer ...");
        webRtcPeer = new kurentoUtils.WebRtcPeer.start('sendRecv', videoInput, videoOutput, onOffer, onError, null, stream);
        prevDetection = true;
    };

    stop = function stop() {
        window.console.log("Stopping video streaming ...");
        setState(I_CAN_START);
        if (webRtcPeer) {
            webRtcPeer.dispose();
            webRtcPeer = null;
            var message = {
                id: 'stop'
            };
            sendMessage(message);
        }
    };

    var stop_all = function stop_all() {
        hideSpinner(videoInput, videoOutput);
        stop();
    };

    var startVideo = function startVideo(message) {
        if (!message.accepted) {
            onError("Can't load the video. Reason: " + message.message);
            if (webRtcVideo) {
                webRtcVideo.dispose();
                webRtcVideo = null;
            }
        } else {
            //videoInput.src = message.sdpAnswer;  // If HttpEndpoint
            window.console.log("Video received from server. Processing...");
            if (message.filter) {
                setState(I_CAN_STOP);
                setIntervalX(recalculate, 500, 12);
            } else {
                setState(I_AM_WITH_VIDEO);
                setIntervalX(recalculate, 500, 12);
            }
            if (typeof webRtcVideo != 'undefined') {
                var sdpa = message.sdpAnswer;
                var newsdpa = addMidsForFirefox(sdp_offer, sdpa);
                webRtcVideo.processSdpAnswer(newsdpa); // If WebRtcEndpoint
                window.setTimeout(function () {
                    if (webRtcVideo.pc) {
                        stream = webRtcVideo.pc.getRemoteStreams()[0]; // In the new version
                    } else if (webRtcVideo.getRemoteStream) {
                        stream = webRtcVideo.getRemoteStream();
                    }
                }, 2000);
            } else {
                MashupPlatform.widget.log('Something wrong happened', MashupPlatform.log.ERROR);
            }
        }
    };

    startResponse = function startResponse(message) {
        setState(I_CAN_STOP);
        window.console.log("SDP answer received from server. Processing ...");
        var sdpa = message.sdpAnswer;
        var newsdpa = addMidsForFirefox(sdp_offer, sdpa);
        webRtcPeer.processSdpAnswer(newsdpa);
        setIntervalX(recalculate, 500, 12);
    };

    setState = function setState (nextState) {
        switch (nextState) {
        case I_AM_WITH_VIDEO:
        case I_CAN_START:
            $('#start').attr('disabled', false);
            $('#stop').attr('disabled', true);
            break;
        case I_CAN_STOP:
            $('#start').attr('disabled', true);
            $('#stop').attr('disabled', false);
            break;
        case I_AM_STARTING:
            $('#start').attr('disabled', true);
            $('#stop').attr('disabled', true);
            break;
        default:
            onError("Unknown state " + nextState);
            return;
        }
        state = nextState;
    };

    onOffer = function onOffer (offerSdp) {
        window.console.info('Invoking SDP offer callback function ' + location.host);
        var message = {
            id: 'start',
            sdpOffer: offerSdp,
            dots: prepare_points_server()
        };
        sendMessage(message);
    };

    onError = function onError (error) {
        //MashupPlatform.widget.drawAttention();
        MashupPlatform.widget.log(error, MashupPlatform.log.ERROR);
        hideSpinner(videoInput, videoOutput);
    };

    var prepare_points_server = function () {
        var np = [];
        for (var i = 0; i < actual; i++) {
            np.push([]);
            for (var j = 0; j < count[i]; j++) {
                np[i].push({x: (points[i][j].x / 100), y: (points[i][j].y / 100)});
            }
        }
        return np;
    };

    var clean_instance = function clean_instance() {
        var instance = jsPlumb.getInstance({
            DragOptions: {cursor: 'pointer', zIndex: 2000},
            Container: "myCanvas"
        });
        instance.registerConnectionTypes({
            "open": {
                paintStyle: {
                    strokeStyle: "white",
                    lineWidth: 3
                },
                connector: "Straight"
            },
            "open-out": {
                paintStyle: {
                    strokeStyle: "black",
                    lineWidth: 5
                },
                connector: "Straight",
                cssClass: "connector-out"
            },
            "close": {
                paintStyle: {
                    strokeStyle: "black",
                    lineWidth: 3
                },
                connector: "Straight"
            },
            "close-out": {
                paintStyle: {
                    strokeStyle: "white",
                    lineWidth: 5
                },
                connector: "Straight",
                cssClass: "connector-out"
            }
        });
        return instance;
    };

    var setIntervalX = function setIntervalX(callback, delay, repetitions, end_f) {
        var f = end_f || noop;
        var x = 0;
        var intervalID = window.setInterval(function () {
            callback();
            if (++x === repetitions) {
                window.clearInterval(intervalID);
                f();
            }
        }, delay);
    };


    var addMidsForFirefox = function addMidsForFirefox(sdpOffer, sdpAnswer) {
        var sdpOfferLines = sdpOffer.split("\r\n");
        var bundleLine = "";
        var audioMid = "";
        var videoMid = "";
        var nextMid = "";
        var i;
        for (i = 0; i < sdpOfferLines.length; ++i) {
            if (sdpOfferLines[i].indexOf("a=group:BUNDLE") === 0) {
                bundleLine = sdpOfferLines[i];
            } else if (sdpOfferLines[i].indexOf("m=") === 0) {
                nextMid = sdpOfferLines[i].split(" ")[0];
            } else if (sdpOfferLines[i].indexOf("a=mid") === 0) {
                if (nextMid === "m=audio") {
                    audioMid = sdpOfferLines[i];
                } else if (nextMid === "m=video") {
                    videoMid = sdpOfferLines[i];
                }
            }
        }

        var newsdpa = sdpAnswer.replace(/a=group:BUNDLE.*/, bundleLine)
                .replace(/a=mid:audio/, audioMid)
                .replace(/a=mid:video/, videoMid);

        if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
            var splitted = bundleLine.replace('\r\n', '').split(' ');
            if (splitted.length >= 3) {
                newsdpa = newsdpa.replace('m=video', 'a=mid:' + splitted[1] + '\r\nm=video');
                newsdpa = newsdpa + 'a=mid:' + splitted[2] + '\r\n';

            }
            return newsdpa;
        } else {
            return sdpAnswer;
        }

    };

    /****************************************/
    /************AUXILIAR FUNCTIONS**********/
    /****************************************/

    getClickPosition = function getClickPosition (e) {
        var parentPosition = getPosition(e.currentTarget);
        var xPosition = e.clientX - parentPosition.x;
        var yPosition = e.clientY - parentPosition.y;
        return {x: xPosition, y: yPosition};
    };

    var getPosition = function getPosition (element) {
        var xPosition = 0;
        var yPosition = 0;

        while (element) {
            xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
            yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
            element = element.offsetParent;
        }
        return {x: xPosition, y: yPosition};
    };

    var noop = function () {};

    var reset_timer = function reset_timer () {
        if (timer) {
            window.clearTimeout(timer);
            timer = window.setTimeout(stop_edit, 5000);
        }
    };
    var can_finish = function () {
        return (points[actual].length > 2);
    };

    var getPercentage = function (pos) {
        var py = canvas.clientHeight,
            px = canvas.clientWidth;
        var per1 = (pos.x / px) * 100,
            per2 = (pos.y / py) * 100;
        return {x: per1, y: per2};
    };

    var getPixels = function (pos) {
        var py = canvas.clientHeight,
            px = canvas.clientWidth;
        var per1 = (pos.x * px) / 100,
            per2 = (pos.y * py) / 100;
        return {x: per1, y: per2};
    };

    var create_circle = function (x, y) {
        var Div = document.createElement('div');
        Div.className = "circle";
        var percs = getPercentage({x: x - 3, y: y - 3});

        Div.style.left = percs.x + "%";
        Div.style.top = percs.y + "%";

        Div.id = "Dot" + actual + "_" + count[actual];
        return Div;
    };

    var add_redo = function (action, dot, params) {
        redos.push({action: action, dot: dot, params: params});
    };

    var add_action = function (action, dot, params) {
        actions.push({action: action, dot: dot, params: params});
        if (!redding) {
            redos = [];
        }
    };

    var reconnect_until_end = function (ac, type) {
        var uuid1 = "", uuid2 = "";
        for (var i = 1; i < count[ac]; i++) {
            uuid1 = ac + "_" + (i - 1);
            uuid2 = ac + "_" + i;
            instance.detachAllConnections("Dot" + uuid2);
            _addConnection(uuid1, uuid2, type);
        }
    };

    var parse_id = function (Id) {
        var regExpr = /^(Dot)*(\d+)_(\d+)$/g;
        var match = regExpr.exec(Id);
        if (match !== null) {
            return {f: match[2], s: match[3]};
        }
        return null;
    };

    var mv_dot_to = function (el, pos) {
        el.style.left = pos.x + "%";
        el.style.top = pos.y + "%";
    };

    var move_action = function (Id, pos, add_f) {
        var ids = parse_id(Id);
        var el = document.getElementById(Id);
        if (_is_inside_limits(pos)) {
            add_f(MOVE, Id, {pos: points[ids.f][ids.s]});
            points[ids.f][ids.s] = pos;
            mv_dot_to(el, pos);
            redraw();
        }
    };

    var all_set_draggable = function (value) {
        for (var i = 0; i < actual; i++) {
            for (var j = 0; j < count[i];j++) {
                instance.setDraggable("Dot" + i + "_" + j, value);
            }
        }
    };

    var change_class = function (c1, c2) {
        var els = $("." + c1);
        els.removeClass(c1);
        els.addClass(c2);
    };

    var stop_edit = function () {
        var start_f = (camera) ? start : start_v;
        if (actual === 0) {
            return;
        }
        if (count[actual] > 0) {
            clean_last_not_finished();
        }
        if (state === I_CAN_STOP) {
            stop();
            loadVideo();
            start_f = noop;
            window.setTimeout((camera) ? start : start_v, 1000);
        }
        can_edit = false;
        all_set_draggable(false);
        change_class("circle", "circlenoedit");
        change_class("btn-success", "btn-danger");
        $("#toggle-edit").text("Not Editing");

        start_f();
        window.clearTimeout(timer);
        timer = undefined;
    };

    var start_edit = function () {
        can_edit = true;
        all_set_draggable(true);
        change_class("circlenoedit", "circle");
        change_class("btn-danger", "btn-success");
        $("#toggle-edit").text("Editing");
    };

    /****************************************/
    /*************MAIN DRAW FUNCTIONS********/
    /****************************************/

    var showSpinner = function () {
        var number = Math.floor(Math.random() * 25) + 1;
        for (var i = 0; i < arguments.length; i++) {
            arguments[i].poster = './images/transparent-1px.png';
            arguments[i].style.background = "center transparent url('./images/spinners/" + number + ".gif') no-repeat";
        }
    };

    var hideSpinner = function () {
        // spinner.addClass("hide");
        for (var i = 0; i < arguments.length; i++) {
            arguments[i].poster = './images/fiware-logo.png';
            arguments[i].style.background = '';
        }
    };

    var _addConnection = function (first, second, type) {
        instance.connect({uuids: [first, second], type: type});
        instance.connect({uuids: [first, second], type: type + "-out"});
    };

    var _lastConnection = function (type) {
        var first = actual + "_0",
            last = actual + "_" + (points[actual].length - 1);
        _addConnection(first, last, type);
        add_action(FINISH, last, {x: actual});
    };

    var _closeColorPath = function () {
        reconnect_until_end(actual, "close");
        _lastConnection("close");
    };

    var _addEndpoint = function (Id) {
        var ep = instance.addEndpoint("Dot" + Id, dot_endp, {uuid: Id});
        ep.setVisible(false);
    };

    var _addPoint = function (pos, Id) {
        points[actual].push(pos);
        add_action(ADD, Id, {pos: pos});
    };

    var _finishPath = function () {
        if (can_finish()) {
            _closeColorPath();
            points.push([]);
            count.push(0);
            actual += 1;

            occupancy.push(0);
            fluidity.push(0);
            // oc_last_8.push([]);
            // fl_last_8.push([]);

            window.clearTimeout(timer);
            timer = window.setTimeout(stop_edit, 5000);
        }
    };

    var _is_inside_limits = function (pos) {
        var percs = getPercentage(pos);
        return (percs.x >= 0.0 && percs.x <= 100.0) &&
            (percs.y >= 0.0 && percs.y <= 100.0);
    };

    var _add_full_point = function (pos) {
        var percs = getPercentage(pos);
        var circle = create_circle(pos.x, pos.y);
        var Id = actual + "_" + count[actual];
        var preId = actual + "_" + (count[actual] - 1);
        canvas.appendChild(circle);
        _addEndpoint(Id);
        _addPoint(percs, Id);
        _addConnection(preId, Id, "open");
        count[actual] += 1;
        instance.draggable(jsPlumb.getSelector("#myCanvas .circle"), {grid: [1 / canvas.clientHeight, 1 / canvas.clientWidth], stop: _stopDrag});
    };

    var clean_last_not_finished = function () {
        var id = "";
        var eid = "";
        for (var i = 0; i < count[actual]; i++) {
            eid = actual + "_" + i;
            id = "Dot" + eid;
            instance.detachAllConnections(id);
            instance.deleteEndpoint(eid);
            instance.remove(id);
        }
        points[actual] = [];
        count[actual] = 0;
        redos = [];
        actions = [];
    };

    /****************************************/
    /*******CALLBACKS AND EVENT FUNCS********/
    /****************************************/

    _stopDrag = function (e) {
        var pos = {x: e.pos[0], y: e.pos[1]};
        var ids = parse_id(e.el.id);
        var percs = getPercentage(pos);
        var total_diff = Math.abs((Math.abs(percs.x - points[ids.f][ids.s].x) + Math.abs(percs.y - points[ids.f][ids.s].y)) - 1.71);
        if (_is_inside_limits(pos) && (total_diff > 1.0)) {
            add_action(MOVE, e.el.id, {pos: points[ids.f][ids.s]});
            points[ids.f][ids.s] = percs;
            mv_dot_to(e.el, percs);
            dragging = true;
            window.setTimeout(function () {dragging = false;}, 200);
        } else {
            var old_pos = points[ids.f][ids.s];
            mv_dot_to(e.el, old_pos);
        }
        reset_timer();
        redraw();
    };

    redo_action = function () {
        var redo_add = function (Id, pos) {
            var p = getPixels(pos);
            _add_full_point(p);
        };
        var redo_move = function (Id, pos) {
            move_action(Id, pos, add_action);
        };
        var redo_finish = function (x) {
            _finishPath();
        };
        if (!can_edit) {
            window.console.log("Edit mode off");
            return;
        }
        redding = true;
        var act = redos.pop();
        if (act === undefined) {
            window.console.log("You can't redo");
        } else {
            switch (act.action){
            case ADD:
                redo_add(act.dot, act.params.pos);
                break;
            case MOVE:
                redo_move(act.dot, act.params.pos);
                break;
            case FINISH:
                redo_finish(act.params.x);
                break;
            default:
                break;
            }
        }
        redding = false;
    };

    undo_action = function () {
        var undo_add = function (Id, pos) {
            instance.detachAllConnections("Dot" + Id);
            instance.deleteEndpoint(Id);
            instance.remove("Dot" + Id);
            points[actual].pop();
            count[actual] -= 1;
            add_redo(ADD, Id, {pos: pos});
        };
        var undo_move = function (Id, pos) {
            move_action(Id, pos, add_redo);
        };
        var undo_finish = function (Id, x) {
            add_redo(FINISH, Id, {x: x});
            reconnect_until_end(x, "open");
            points.pop();
            count.pop();

            occupancy.pop();
            fluidity.pop();

            actual = x;
        };
        if (!can_edit) {
            window.console.log("Edit mode off");
            return;
        }
        var act = actions.pop();
        if (act === undefined) {
            window.console.log("You can't undo more actions.");
        } else {
            switch (act.action) {
            case ADD:
                undo_add(act.dot, act.params.pos);
                break;
            case MOVE:
                undo_move(act.dot, act.params.pos);
                break;
            case FINISH:
                undo_finish(act.dot, act.params.x);
                break;
            default:
                break;
            }
        }
    };

    handle_edit = function (e) {
        if (can_edit) {
            stop_edit();
        }else {
            start_edit();
        }
    };

    /* click handler */
    handler = function handler (e) {
        if (!can_edit || dragging) {
            return;
        }
        if (e.target.id === "Dot" + actual + "_0") {
            _finishPath();
        } else if (e.target.id === "myCanvas") {
            var pos = getClickPosition(e);
            _add_full_point(pos);
            reset_timer();
        }
        redraw();
    };

    // Double click handler
    handler_dbl = function handler_dbl (e) {
        if (can_edit) {
            _finishPath();
        }
    };

    // Key press handler
    keyHandler = function (e) {
        var eobj = window.event ? window.event : e;
        if (can_edit && eobj.keyCode === 90 && eobj.ctrlKey && !eobj.shiftKey) {
            undo_action();
            reset_timer();
        } else if (can_edit && eobj.keyCode === 90 && eobj.ctrlKey && eobj.shiftKey) {
            redo_action();
            reset_timer();
        }
    };

    /* test-code */
    var reset = function () {
        webRtcVideo = null;
    };

    var getUrl = function () {
        return url;
    };

    var getUseCamera = function () {
        return camera;
    };

    var getFilePath = function () {
        return file_path;
    };

    var getState = function () {
        return state;
    };

    var getCanEdit = function () {
        return can_edit;
    };

    var getActual = function () {
        return actual;
    };

    var setCanvas = function (e) {
        canvas = e;
    };

    var getShowSpinner = function () {
        return showSpinner;
    };

    var setShowSpinner = function (f) {
        showSpinner = f;
    };

    var getTimer = function () {
        return timer;
    };

    var setTimer = function (t) {
        timer = t;
    };

    CrowdDetector.prototype = {
        'reset': reset,
        'getUrl': getUrl,
        'getUseCamera': getUseCamera,
        'getFilePath': getFilePath,
        'getState': getState,
        'getCanEdit': getCanEdit,
        'getActual': getActual,
        'loadPreferences': loadPreferences,
        'getClickPosition': getClickPosition,
        'getPercentage': getPercentage,
        'setCanvas': setCanvas,
        'arrayequals': Array.prototype.equals,
        'start_edit': start_edit,
        'handle_edit': handle_edit,
        'handler': handler,
        'getShowSpinner': getShowSpinner,
        'setShowSpinner': setShowSpinner,
        'stopDrag': _stopDrag,
        'redo_action': redo_action,
        'undo_action': undo_action,
        'handler_dbl': handler_dbl,
        'keyHandler': keyHandler,
        'parse_id': parse_id,
        'move_action': move_action,
        'getTimer': getTimer,
        'setTimer': setTimer,
        'reset_timer': reset_timer,
        'setIntervalX': setIntervalX,
        'hidePath': hidePath,
        'showPath': showPath,
        'setState': setState,
        'send_all_wiring': send_all_wiring //,
        // 'start': start
    };

    /* end-testcode */

    return CrowdDetector;

})();
