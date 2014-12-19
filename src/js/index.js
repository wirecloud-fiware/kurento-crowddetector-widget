var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
var nDots = 0;
var dots = [];
var percDots = [];
var ws = new WebSocket('ws://130.206.81.33:8080/crowddetector');
var webRtcPeer;
var state = null;
var videoInput = document.getElementById('videoInput');
var videoOutput = document.getElementById('videoOutput');
var prevDetection = false;
this.setState(I_CAN_START);

navigator.getMedia = ( navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);

navigator.getMedia (

   // constraints
   {
      video: true,
      audio: true
   },

   // successCallback
   function(localMediaStream) {
      videoInput.src = window.URL.createObjectURL(localMediaStream);
      recalculate();
   },

   // errorCallback
   function(err) {
    console.log("Ocurrió el siguiente error: " + err);
   });

window.onbeforeunload = function() {
	ws.close();
}

window.addEventListener("resize", recalculate, false);
canvas.addEventListener("click", handler, false);
//clear.addEventListener("click", clearDots, false);
window.addEventListener("load", recalculate, false);

const MAX_DOTS = 4;
const I_CAN_START = 0;
const I_CAN_STOP = 1;
const I_AM_STARTING = 2;


function clearDots () {
	ctx.clearRect ( 0 , 0 , canvas.width, canvas.height );
	dots = [];
	percDots = [];
	nDots = 0;
}

function redraw (canvasPrev) {

	adjustDots(canvasPrev);

	for (var i=0; i<dots.length; i++) {
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
		for (var i=1; i<dots.length; i++) {
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
		for (var i=1; i<dots.length; i++) {
			ctx.lineTo(dots[i].x, dots[i].y);
		}
		if (nDots === 4) {
			ctx.closePath();
		}
		ctx.stroke();
	}
}

function adjustDots(canvasPrev) {
	for (var i=0; i<dots.length; i++) {
		dots[i].x = dots[i].x*canvas.width/canvasPrev.width;
		dots[i].y = dots[i].y*canvas.height/canvasPrev.height;
	}
}

function handler (e) {
	if (nDots >= 4) {
		return;
	}
	var coord = getCursorPosition(e);
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
		for (var i=1; i<dots.length; i++) {
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
		for (var i=1; i<dots.length; i++) {
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
}

function getCursorPosition(e) {
	var rect = canvas.getBoundingClientRect(),
    	x = e.clientX - rect.left,
    	y = e.clientY - rect.top,
    	percX = e.hasOwnProperty('offsetX') ? e.offsetX/canvas.width : e.layerX/canvas.width,
    	percY = e.hasOwnProperty('offsetY') ? e.offsetY/canvas.height : e.layerY/canvas.height;

    percDots.push({x: percX, y: percY});
	return {x: x, y: y};
}

function recalculate () {

	var videoWidth = videoInput.videoWidth,
		videoHeight = videoInput.videoHeight,
		clientWidth = videoInput.clientWidth,
		clientHeight = videoInput.clientHeight,
		videoRatio = videoWidth / videoHeight,
		windowRatio = window.innerWidth/window.innerHeight,
		canvasPrev = {width: canvas.width, height: canvas.height};


	canvas.style.left = 0 + 'px';
	canvas.style.top = 0 + 'px';
	// FORMULA: original height / original width x new width = new height
	// FORMULA: new width = new height * original width / originalheight

	if (windowRatio > videoRatio) {
		var canvasWidth = videoWidth * (clientHeight / videoHeight);
		canvas.width = canvasWidth;
		canvas.height = window.innerHeight;
		canvas.style.left = (clientWidth - canvasWidth) / 2 + 'px';
	} else {
		var canvasHeight = videoHeight * (clientWidth / videoWidth);
		canvas.height = canvasHeight;
		canvas.width = window.innerWidth;
		canvas.style.top = (clientHeight - canvasHeight) / 2 + 'px';
	}

	redraw(canvasPrev);
}

ws.onopen = function () {
	console.log("WebSocket connected.")
}

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);

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
}

function crowdDetectorDirection(message) {
	console.log ("Direction event received in roi " + message.event_data.roiID +
	 " with direction " + message.event_data.directionAngle);
}

function crowdDetectorFluidity(message) {
	console.log ("Fluidity event received in roi " + message.event_data.roiID +
	 ". Fluidity level " + message.event_data.fluidityPercentage +
	 " and fluidity percentage " + message.event_data.fluidityLevel);
}

function crowdDetectorOccupancy(message) {
	console.log ("Occupancy event received in roi " + message.event_data.roiID +
	 ". Occupancy level " + message.event_data.occupancyPercentage +
	 " and occupancy percentage " + message.event_data.occupancyLevel);
}

function start() {
	console.log("Starting video call ...")
	// Disable start button
	setState(I_AM_STARTING);

	console.log("Creating WebRtcPeer and generating local sdp offer ...");
	webRtcPeer = kurentoUtils.WebRtcPeer.startSendRecv(videoInput, videoOutput, onOffer, onError);
	prevDetection = true;
}

function onOffer(offerSdp) {
	console.info('Invoking SDP offer callback function ' + location.host);
	var message = {
		id : 'start',
		sdpOffer : offerSdp,
		dots: percDots
	}
	sendMessage(message);
	clearDots();
}

function onError(error) {
	console.error(error);
}

function startResponse(message) {
	setState(I_CAN_STOP);
	console.log("SDP answer received from server. Processing ...");
	webRtcPeer.processSdpAnswer(message.sdpAnswer);
	videoOutput.className = "";
	videoInput.className = "hide";
}

function stop() {
	console.log("Stopping video call ...");
	setState(I_CAN_START);
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;

		var message = {
			id : 'stop'
		}
		sendMessage(message);
	}
}

function setState(nextState) {
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
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	console.log('Sending message: ' + jsonMessage);
	ws.send(jsonMessage);
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
// $(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
// 	event.preventDefault();
// 	$(this).ekkoLightbox();
// });