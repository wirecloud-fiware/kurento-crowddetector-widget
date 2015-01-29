/*global $, kurentoUtils, MashupPlatform */

(function () {

    "use strict";

    var canvas = document.getElementById("myCanvas");
    var ctx = canvas.getContext("2d");
    var nDots = 0;
    var dots = [];
    var percDots = [];
    var ws = null;
    var webRtcPeer;
    var stream;
    var state = null;
    var videoInput = document.getElementById('videoInput');
    var videoOutput = document.getElementById('videoOutput');
    var clear = document.getElementById('clear');
    var file = document.getElementById('file');
    var video_url = document.getElementById('video_url');
    var prevDetection = false;

    var I_CAN_START = 0;
    var I_CAN_STOP = 1;
    var I_AM_STARTING = 2;


    var playVideoFile = function playVideoFile(e) {
        videoInput.src = window.URL.createObjectURL(e.currentTarget.files[0]);
        stream = videoInput.mozCaptureStream();
        recalculate();
    };

    var playVideoFromURL = function playVideoFromURL () {
        videoInput.src = video_url.value;
        stream = videoInput.mozCaptureStream();
        recalculate();
    };

    var handlePreferences = function handlePreferences() {

    };

    var clearDots = function clearDots() {
        ctx.clearRect ( 0 , 0 , canvas.width, canvas.height );
        dots = [];
        percDots = [];
        nDots = 0;
    };

    var redraw = function redraw(canvasPrev) {
        var i;

        adjustDots(canvasPrev);

        for (i = 0; i < dots.length; i++) {
            ctx.beginPath();
            ctx.arc(dots[i].x, dots[i].y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = "white";
            ctx.fill();
            ctx.stroke();
        }

        if (nDots > 1) {
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.moveTo(dots[0].x, dots[0].y);
            for (i=1; i<dots.length; i++) {
                ctx.lineTo(dots[i].x, dots[i].y);
            }
            if (nDots === 4) {
                ctx.closePath();
            }
            ctx.stroke();

            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "white";
            ctx.moveTo(dots[0].x, dots[0].y);
            for (i=1; i<dots.length; i++) {
                ctx.lineTo(dots[i].x, dots[i].y);
            }
            if (nDots === 4) {
                ctx.closePath();
            }
            ctx.stroke();
        }
    };

    var adjustDots = function adjustDots(canvasPrev) {
        for (var i = 0; i < dots.length; i++) {
            dots[i].x = dots[i].x*canvas.width/canvasPrev.width;
            dots[i].y = dots[i].y*canvas.height/canvasPrev.height;
        }
    };

    var handler = function handler(e) {
        var i, coord;

        if (nDots >= 4) {
            return;
        }
        coord = getCursorPosition(e);
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 4, 0, 2 * Math.PI);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.stroke();
        dots.push(coord);
        nDots += 1;
        if (nDots > 1) {
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.moveTo(dots[0].x, dots[0].y);
            for (i = 1; i < dots.length; i++) {
                ctx.lineTo(dots[i].x, dots[i].y);
            }
            if (nDots === 4) {
                ctx.closePath();
            }
            ctx.stroke();

            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "white";
            ctx.moveTo(dots[0].x, dots[0].y);
            for (i = 1; i < dots.length; i++) {
                ctx.lineTo(dots[i].x, dots[i].y);
            }
            if (nDots === 4) {
                ctx.closePath();
                // Send 'start' request as soon as 4 points are given
                if (prevDetection) {
                    stop();
                }
                start();
            }
            ctx.stroke();
        }
    };

    var getCursorPosition = function getCursorPosition(e) {
        var rect = canvas.getBoundingClientRect(),
            x = e.clientX - rect.left,
            y = e.clientY - rect.top,
            percX = e.hasOwnProperty('offsetX') ? e.offsetX/canvas.width : e.layerX/canvas.width,
            percY = e.hasOwnProperty('offsetY') ? e.offsetY/canvas.height : e.layerY/canvas.height;

        percDots.push({x: percX, y: percY});
        return {x: x, y: y};
    };

    var recalculate = function recalculate() {

        videoInput.style.height = (window.innerHeight - 51) + 'px';
        videoOutput.style.height = (window.innerHeight - 51) + 'px';

        var videoWidth = videoInput.videoWidth,
            videoHeight = videoInput.videoHeight,
            clientWidth = videoInput.clientWidth,
            clientHeight = videoInput.clientHeight,
            videoRatio = videoWidth / videoHeight,
            windowRatio = window.innerWidth/window.innerHeight,
            canvasPrev = {width: canvas.width, height: canvas.height};


        canvas.style.left = 0 + 'px';
        canvas.style.top = 51 + 'px';
        // FORMULA: original height / original width x new width = new height
        // FORMULA: new width = new height * original width / originalheight

        if (windowRatio > videoRatio) {
            var canvasWidth = videoWidth * (clientHeight / videoHeight);
            canvas.width = canvasWidth;
            canvas.height = window.innerHeight - 51;
            canvas.style.left = (clientWidth - canvasWidth) / 2 + 'px';
        } else {
            var canvasHeight = videoHeight * (clientWidth / videoWidth);
            canvas.height = canvasHeight;
            canvas.width = window.innerWidth;
            canvas.style.top = ((clientHeight - canvasHeight) / 2) + 51 + 'px';
        }

        redraw(canvasPrev);
    };

    var onWebsocketError = function onWebsocketError() {
        onError("Error creating WebSocket");
    };

    var onWebsocketConnection = function onWebsocketConnection() {
        MashupPlatform.widget.log("WebSocket connected.", MashupPlatform.log.INFO);
    };

    var onWebsocketMessage = function onWebsocketMessage(message) {
        var parsedMessage = JSON.parse(message.data);
        MashupPlatform.widget.log('Received message: ' + message.data, MashupPlatform.log.INFO);

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

    var connect = function connect(url) {
        setState(I_AM_STARTING);

        ws = new WebSocket(url);
        ws.onerror = onWebsocketError;
        ws.onopen = onWebsocketConnection;
        ws.onmessage = onWebsocketMessage;
    };

    var crowdDetectorDirection = function crowdDetectorDirection(message) {
        MashupPlatform.widget.log("Direction event received in roi " + message.event_data.roiID +
         " with direction " + message.event_data.directionAngle, MashupPlatform.log.INFO);
    };

    var crowdDetectorFluidity = function crowdDetectorFluidity(message) {
        MashupPlatform.widget.log("Fluidity event received in roi " + message.event_data.roiID +
         ". Fluidity level " + message.event_data.fluidityPercentage +
         " and fluidity percentage " + message.event_data.fluidityLevel, MashupPlatform.log.INFO);
    };

    var crowdDetectorOccupancy = function crowdDetectorOccupancy(message) {
        MashupPlatform.widget.log("Occupancy event received in roi " + message.event_data.roiID +
         ". Occupancy level " + message.event_data.occupancyPercentage +
         " and occupancy percentage " + message.event_data.occupancyLevel, MashupPlatform.log.INFO);
    };

    var start = function start() {
        MashupPlatform.widget.log("Starting video call ...", MashupPlatform.log.INFO);
        // Disable start button
        setState(I_AM_STARTING);

        MashupPlatform.widget.log("Creating WebRtcPeer and generating local sdp offer ...", MashupPlatform.log.INFO);
        webRtcPeer = new kurentoUtils.WebRtcPeer.start('sendRecv', videoInput, videoOutput, onOffer, onError, null, stream);
        prevDetection = true;
    };

    var onOffer = function onOffer(offerSdp) {
        MashupPlatform.widget.log('Invoking SDP offer callback function ' + location.host, MashupPlatform.log.INFO);
        var message = {
            id : 'start',
            sdpOffer : offerSdp,
            dots: percDots
        };
        sendMessage(message);
        clearDots();
    };

    var onError = function onError(error) {
        MashupPlatform.widget.log(error, MashupPlatform.log.ERROR);
    };

    var startResponse = function startResponse(message) {
        setState(I_CAN_STOP);
        MashupPlatform.widget.log("SDP answer received from server. Processing ...", MashupPlatform.log.INFO);
        webRtcPeer.processSdpAnswer(message.sdpAnswer);
        videoOutput.className = "";
        videoInput.className = "hide";
    };

    var stop = function stop() {
        MashupPlatform.widget.log("Stopping video call ...", MashupPlatform.log.INFO);
        setState(I_CAN_START);
        if (webRtcPeer) {
            webRtcPeer.dispose();
            webRtcPeer = null;

            var message = {
                id : 'stop'
            };
            sendMessage(message);
        }
    };

    var setState = function setState(nextState) {
        switch (nextState) {
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

    var sendMessage = function sendMessage(message) {
        var jsonMessage = JSON.stringify(message);
        MashupPlatform.widget.log('Sending message: ' + jsonMessage, MashupPlatform.log.INFO);
        ws.send(jsonMessage);
    };

    window.onbeforeunload = function() {
        if (ws != null) {
            ws.close();
        }
    };

    // Init code
    canvas.addEventListener("click", handler, false);
    clear.addEventListener("click", clearDots, false);
    file.addEventListener("change", playVideoFile, false);

    videoInput.addEventListener("loadedmetadata", function () {
        recalculate();
    }, false);
    video_url.addEventListener("submit", playVideoFromURL, false);
    window.addEventListener("load", recalculate, false);
    window.addEventListener("resize", recalculate, false);
    MashupPlatform.wiring.registerCallback('video_url', playVideoFromURL);
    MashupPlatform.prefs.registerCallback(handlePreferences);
    connect(MashupPlatform.prefs.get('server-url'));

    /**
     * Lightbox utility (to display media pipeline image in a modal dialog)
     */
    // $(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
    // 	event.preventDefault();
    // 	$(this).ekkoLightbox();
    // });

})();
