/*global $, kurentoUtils, MashupPlatform, jsPlumb */

(function () {

    "use strict";
    
    var canvas = document.getElementById("myCanvas");
    
    var ws = null;
    var webRtcPeer;
    var stream;
    var state = null;
    var videoInput = document.getElementById('videoInput');
    var videoOutput = document.getElementById('videoOutput');
    var clear = document.getElementById('clear');
    var undo_btn = document.getElementById('undo');
    var redo_btn = document.getElementById('redo');
    var edit_btn = document.getElementById('toggle-edit');
    var file = document.getElementById('file');
    var video_url = document.getElementById('video_url');
    var prevDetection = false;

    var count = [0];
    var points = [[]];
    var actual = 0;
    var actions = [];
    var redos = [];

    var redding = false;
    var dragging = false;
    var can_edit = true;
    
    var I_CAN_START = 0;
    var I_CAN_STOP = 1;
    var I_AM_STARTING = 2;

    var ADD = "Add";
    var MOVE = "Move";
    var FINISH = "Finish";
    
    var initialize = function initialize(){
        count = [0];
        points = [[]];
        actual = 0;        
    };
    
    var getClickPosition = function getClickPosition(e) {
        var parentPosition = getPosition(e.currentTarget);
        var xPosition = e.clientX - parentPosition.x;
        var yPosition = e.clientY - parentPosition.y;
        return {x: xPosition, y: yPosition};
    };

    var getPosition = function getPosition(element) {
        var xPosition = 0;
        var yPosition = 0;
        
        while (element) {
            xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
            yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
            element = element.offsetParent;
        }
        return { x: xPosition, y: yPosition };
    };

    jsPlumb.ready(function(){

        var clean_instance = function(){
            var instance = jsPlumb.getInstance({
                DragOptions : { cursor: 'pointer', zIndex:2000 },
                Container:"myCanvas"
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

        var instance = clean_instance();
        
        var dot_endp = {
            endpoint: "Dot",
            cssClass: "endpoint",
            anchor:[0.5,0.5,0,-1],
            endpointsOnTop:false,
            isTarget: true,
            isSource: true,
            maxConnections: 4
        };
        
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
            instance.reset();
            $("#myCanvas .circle").remove();
            initialize();
            instance = clean_instance();
        };

        var redraw = function redraw() {
            instance.repaintEverything();
        };
        
        var can_finish = function(){
            return (points[actual].length > 2);  
        };
        
        var getPercentage = function(pos){
            var py = canvas.clientHeight,
                px = canvas.clientWidth;
            var per1 = (pos.x / px) * 100,
                per2 = (pos.y / py) * 100;
            return {x: per1, y: per2};
        };

        var getPixels = function(pos){
            var py = canvas.clientHeight,
                px = canvas.clientWidth;
            var per1 = (pos.x * px) / 100,
                per2 = (pos.y * py) / 100;
            return {x: per1, y: per2};
        };

        var create_circle = function(x,y){
            var Div = document.createElement('div');
            Div.className = "circle";
            var percs = getPercentage({x:x-3,y:y-3});
            
            Div.style.left = percs.x + "%";
            Div.style.top = percs.y + "%"; 
            
            Div.id = "Dot" + actual + "_" + count[actual];
            return Div;
        };

        var add_redo = function(action, dot, params){
            redos.push({action:action, dot:dot, params:params});
        };
        
        var add_action = function(action, dot, params){
            actions.push({action:action, dot:dot, params:params});
            if (! redding){
                redos = [];
            }
        };

        var _addConnection = function(first, second, type){
            instance.connect({uuids:[first,second], type:type});
            instance.connect({uuids:[first,second], type:type+"-out"});
        };

        var _lastConnection = function(type){
            var first = actual + "_0",
                last = actual + "_" + (points[actual].length - 1);
            _addConnection(first, last, type);
            add_action(FINISH, last, {x: actual});
        };

        var reconnect_until_end = function(ac, type){
            var uuid1 = "", uuid2="";
            for(var i=1; i<count[ac]; i++){
                uuid1 = ac + "_" + (i-1);
                uuid2 = ac + "_" + i;
                instance.detachAllConnections("Dot" + uuid2);
                _addConnection(uuid1, uuid2, type);
            }
        };

        var _closeColorPath = function(){
            reconnect_until_end(actual, "close");
            _lastConnection("close");
        };

        var _addEndpoint = function(Id){
            var ep = instance.addEndpoint("Dot"+Id, dot_endp, {uuid: Id});
            ep.setVisible(false);
        };

        var _addPoint = function(pos, Id){
            points[actual].push(pos);
            add_action(ADD, Id, {pos:pos});
        };

        var _finishPath = function(){
            if (can_finish()){
                _closeColorPath();
                points.push([]);
                count.push(0);
                actual += 1;

                if(prevDetection){
                    stop();
                }
                start();
            }
        };

        var parse_id = function(Id){
            var regExpr = /(Dot)*(\d+)_(\d+)/g;
            var match = regExpr.exec(Id);
            if (match != null){
                return {f:match[2], s:match[3]};   
            }
            return null;
        };

        var mv_dot_to = function(el,pos){
            el.style.left = pos.x + "%";
            el.style.top = pos.y + "%";
        };

        var _is_inside_limits = function(pos){
            var percs = getPercentage(pos);
            return (percs.x >= 0.0 && percs.x <= 100.0) &&
                (percs.y >= 0.0 && percs.y <= 100.0);
        };

        var _stopDrag = function(e){
            var pos = {x:e.pos[0],y:e.pos[1]};
            var ids = parse_id(e.el.id);
            if(_is_inside_limits(pos)){
                var percs = getPercentage(pos);
                var total_diff = (Math.abs(percs.x - points[ids.f][ids.s].x) + Math.abs(percs.y - points[ids.f][ids.s].y)) - 1.71;
                if (!((total_diff > 0) && (total_diff < 0.009))){
                    add_action(MOVE, e.el.id, {pos:points[ids.f][ids.s]});
                    points[ids.f][ids.s] = percs;
                }
            }
            else{
                var old_pos = points[ids.f][ids.s];
                mv_dot_to(e.el, old_pos);
            }
            redraw();
            dragging = true;
            window.setTimeout(function(){dragging = false;}, 200);
        };

        var move_action = function(Id, pos, add_f){
            var ids = parse_id(Id);
            var el = document.getElementById(Id);
            if(_is_inside_limits(pos)){
                add_f(MOVE, Id, {pos:points[ids.f][ids.s]});
                points[ids.f][ids.s] = pos;
                mv_dot_to(el, pos);
                redraw();
            }
        };
        
        var redo_action = function(){
            var redo_add = function(Id, pos){
                var p = getPixels(pos);
                _add_full_point(p);
            };
            var redo_move = function(Id, pos){
                move_action(Id, pos, add_action);
            };
            var redo_finish = function(x){
                _finishPath();
            };
            redding = true;
            var act = redos.pop(); //pop_and_push(redos, actions);
            if (act === undefined){
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

        var undo_action = function(){
            var undo_add = function(Id, pos){
                instance.detachAllConnections("Dot" + Id);
                instance.deleteEndpoint(Id);
                instance.remove("Dot"+Id);
                points[actual].pop();
                count[actual] -= 1;
                add_redo(ADD, Id, {pos:pos});
            };
            var undo_move = function(Id, pos){
                move_action(Id, pos, add_redo);
            };
            var undo_finish = function(Id,x){
                add_redo(FINISH, Id, {x:x});
                reconnect_until_end(x,"open");
                points.pop();
                count.pop();
                actual = x;
            };
            var act = actions.pop();
            if (act === undefined){
                window.console.log("You can't undo more actions.");
            }
            else {
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

        var _add_full_point = function(pos){
            var percs = getPercentage(pos);
            var circle = create_circle(pos.x,pos.y);
            var Id = actual + "_" + count[actual];
            var preId = actual + "_" + (count[actual]-1);
            canvas.appendChild(circle);
            _addEndpoint(Id);
            _addPoint(percs, Id);
            _addConnection(preId, Id, "open");
            count[actual] += 1;
            instance.draggable(jsPlumb.getSelector("#myCanvas .circle"), { grid: [1/canvas.clientHeight, 1/canvas.clientWidth], stop: _stopDrag });
        };

        var all_set_draggable = function(value){
            for(var i=0; i<actual; i++){
                for(var j=0; j<count[i];j++){
                    instance.setDraggable("Dot"+i+"_"+j, value);
                }
            }
        };

        var change_class = function(c1, c2){
            var els = $("."+c1);
            els.removeClass(c1);
            els.addClass(c2);
        };
        
        var stop_edit = function(){
            can_edit = false;
            all_set_draggable(false);
            change_class("circle", "circlenoedit");
            $("#toggle-edit").removeClass("btn-success");
            $("#toggle-edit").addClass("btn-danger");
            $("#toggle-edit").text("Not Editing");
        };
        var start_edit = function(){
            can_edit = true;
            all_set_draggable(true);
            change_class("circlenoedit", "circle");
            $("#toggle-edit").removeClass("btn-danger");
            $("#toggle-edit").addClass("btn-success");
            $("#toggle-edit").text("Editing");
        };

        var handle_edit = function(e){
            if (can_edit){
                stop_edit();
            }else {
                start_edit();
            }
        };
        
        var handler = function handler(e) {
            if(!can_edit || dragging){
                return;
            }
            if(e.target.id === "Dot" + actual + "_0"){
                _finishPath();
            }
            else if(e.target.id === "myCanvas"){
                var pos = getClickPosition(e);
                _add_full_point(pos);
            }
            redraw();
        };
        
        var handler_dbl = function handler_dbl(e){
            if(can_edit){
                _finishPath();
            }
        };

        var keyHandler = function(e){
            var eobj = window.event ? window.event : e;
            if (can_edit && eobj.keyCode === 90 && eobj.ctrlKey && ! eobj.shiftKey){
                undo_action();
            }else if (can_edit && eobj.keyCode === 90 && eobj.ctrlKey && eobj.shiftKey){
                redo_action();
            }
        };
        
        var recalculate = function recalculate() {
            videoInput.style.height = (window.innerHeight - 51) + 'px';
            videoOutput.style.height = (window.innerHeight - 51) + 'px';

            var videoWidth = videoInput.videoWidth,
                videoHeight = videoInput.videoHeight,
                clientWidth = videoInput.clientWidth,
                clientHeight = videoInput.clientHeight,
                videoRatio = videoWidth / videoHeight,
                windowRatio = window.innerWidth/window.innerHeight;

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
                dots: points  // Transform to relative (0 to 1 percentage)
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
        canvas.addEventListener("dblclick", handler_dbl, false);
        clear.addEventListener("click", clearDots, false);
        undo_btn.addEventListener("click", undo_action, false);
        redo_btn.addEventListener("click", redo_action, false);
        edit_btn.addEventListener("click", handle_edit);
        file.addEventListener("change", playVideoFile, false);

        document.onkeydown = keyHandler;

        videoInput.addEventListener("loadedmetadata", function () {
            recalculate();
        }, false);
        video_url.addEventListener("submit", playVideoFromURL, false);
        window.addEventListener("load", recalculate, false);
        window.setTimeout(recalculate, 0);
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
    });
})();
