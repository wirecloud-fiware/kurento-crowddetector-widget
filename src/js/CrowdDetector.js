/*global $, kurentoUtils, MashupPlatform, jsPlumb*/
/*exported CrowdDetector*/
var CrowdDetector = (function () {
    "use strict";

    /*********************************************************
     ************************CONSTANTS*************************
     *********************************************************/
    
    var I_CAN_START = 0,
        I_CAN_STOP = 1,
        I_AM_STARTING = 2;
    var ADD = "Add",
        MOVE = "Move",
        FINISH = "Finish";
    
    var dot_endp = {
        endpoint: "Dot",
        cssClass: "endpoint",
        anchor:[0.5,0.5,0,-1],
        endpointsOnTop:false,
        isTarget: true,
        isSource: true,
        maxConnections: 4
    };

    /*********************************************************
    ************************VARIABLES*************************
    *********************************************************/
    var canvas, count, points, actual, timer, actions, redos, redding, dragging, can_edit, instance, ws,
        webRtcPeer, stream, state, videoInput, videoOutput, prevDetection, url;
    var clear, undo_btn, redo_btn, edit_btn;

    var sendMessage, clearDots, redraw, recalculate, crowdDetectorDirection, crowdDetectorFluidity, crowdDetectorOccupancy,
        start, startResponse, setState, setWebSocketEvents, onOffer, onError, activateCamera, stop, connect;

    var _stopDrag, redo_action, undo_action, handle_edit, handler, handler_dbl, keyHandler;
    
    /********************************************************/
    /**********************CONSTRUCTOR***********************/
    /********************************************************/

    var CrowdDetector = function CrowdDetector () {
        jsPlumb.ready(function () {
            instance = clean_instance();
        });
        
        canvas = document.getElementById("myCanvas");

        clear = document.getElementById('clear');
        undo_btn = document.getElementById('undo');
        redo_btn = document.getElementById('redo');
        edit_btn = document.getElementById('toggle-edit');
        
        count = [0];
        points = [[]];
        actual = 0;
        actions = [];
        redos = [];
        
        timer = 0;
        
        redding = false;
        dragging = false;
        can_edit = false;
        
        ws = null;
        videoInput = document.getElementById('videoInput');
        videoOutput = document.getElementById('videoOutput');
        prevDetection = false;
        setState(I_CAN_START);
        
        // Events
        canvas.addEventListener("click", handler, false);
        canvas.addEventListener("dblclick", handler_dbl, false);
        clear.addEventListener("click", clearDots, false);
        undo_btn.addEventListener("click", undo_action, false);
        redo_btn.addEventListener("click", redo_action, false);
        edit_btn.addEventListener("click", handle_edit);
        
        document.onkeydown = keyHandler;
        
        window.addEventListener("load", recalculate, false);
        window.addEventListener("resize", recalculate, false);
        
        url = MashupPlatform.prefs.get('server-url');
        
        // Register wiring callback
        MashupPlatform.wiring.registerCallback('activate_detection', function (data) {
            activateCamera();
        });

        // Register preference callback
        MashupPlatform.prefs.registerCallback(function () {
            url = MashupPlatform.prefs.get('server-url');
            connect(url);
        });        

        // Connect to server url
        connect(url);
    };
    

    /*********************************************************
    **************************PRIVATE*************************
    *********************************************************/


    connect = function connect (url) {
        if (ws !== null) {
            ws.close();
        }

        ws = new WebSocket(url);
        setWebSocketEvents();
        window.onbeforeunload = function () {
            if (ws !== null) {
                ws.close();
            }
        };
    };

    setWebSocketEvents = function setWebSocketEvents () {
        ws.onopen = function () {
            MashupPlatform.widget.log("WebSocket connected.", MashupPlatform.log.INFO);
            activateCamera();
        };

        ws.onmessage = function (message) {
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

        ws.onerror = function () {
            onError("Error creating WebSocket");
        };
    };

    activateCamera = function activateCamera () {
        navigator.getMedia = (navigator.getUserMedia ||
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
            function (localMediaStream) {
                stream = localMediaStream;
                videoInput.src = window.URL.createObjectURL(localMediaStream);
                videoInput.onloadedmetadata = function (e) {
                    window.setTimeout(function () {
                        window.console.log(videoInput.videoWidth);
                        recalculate();
                        start_edit();
                    }, 2000);
                };
            },

            // errorCallback
            function (err) {
                window.console.log("Ocurrió el siguiente error: " + err);
            });
    };

    stop = function stop() {
        window.console.log("Stopping video call ...");
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

    sendMessage = function sendMessage (message) {
        var jsonMessage = JSON.stringify(message);
        window.console.log('Sending message: ' + jsonMessage);
        ws.send(jsonMessage);
    };

    clearDots = function clearDots () {
        count = [0];
        points = [[]];
        actual = 0;
        instance.reset();
        $("#myCanvas .circle").remove();
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
    
    crowdDetectorDirection = function crowdDetectorDirection(message) {
        window.console.log ("Direction event received in roi " + message.event_data.roiID +
         " with direction " + message.event_data.directionAngle);
    };

    crowdDetectorFluidity = function crowdDetectorFluidity(message) {
        window.console.log ("Fluidity event received in roi " + message.event_data.roiID +
         ". Fluidity level " + message.event_data.fluidityPercentage +
         " and fluidity percentage " + message.event_data.fluidityLevel);
    };

    crowdDetectorOccupancy = function crowdDetectorOccupancy(message) {
        window.console.log ("Occupancy event received in roi " + message.event_data.roiID +
         ". Occupancy level " + message.event_data.occupancyPercentage +
         " and occupancy percentage " + message.event_data.occupancyLevel);
    };

    start = function start() {
        window.console.log("Starting video call ...");
        // Disable start button
        setState(I_AM_STARTING);

        window.console.log("Creating WebRtcPeer and generating local sdp offer ...");
        webRtcPeer = new kurentoUtils.WebRtcPeer.start('sendRecv', videoInput, videoOutput, onOffer, onError, null, stream);
        prevDetection = true;
    };

    startResponse = function startResponse(message) {
        setState(I_CAN_STOP);
        window.console.log("SDP answer received from server. Processing ...");
        webRtcPeer.processSdpAnswer(message.sdpAnswer);
        videoOutput.className = "";
        videoInput.className = "hide";
        setIntervalX(recalculate, 500, 12);
    };

    setState = function setState (nextState) {
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

    onOffer = function onOffer (offerSdp) {
        window.console.info('Invoking SDP offer callback function ' + location.host);
        var message = {
            id: 'start',
            sdpOffer: offerSdp,
            dots: prepare_points_server()
        };
        sendMessage(message);
        //clearDots();
    };

    onError = function onError (error) {
        MashupPlatform.widget.log(error, MashupPlatform.log.ERROR);
    };

    var prepare_points_server = function () {
        var np = [];
        for (var i=0; i<actual; i++) {
            np.push([]);
            for (var j=0; j<count[i]; j++) {
                np[i].push({x:(points[i][j].x / 100), y:(points[i][j].y / 100)});
            }
        }
        return np;
    };

    var clean_instance = function clean_instance() {
        var instance = jsPlumb.getInstance({
            DragOptions: {cursor: 'pointer', zIndex:2000},
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

    var setIntervalX = function setIntervalX(callback, delay, repetitions) {
        var x = 0;
        var intervalID = window.setInterval(function () {

            callback();

            if (++x === repetitions) {
                window.clearInterval(intervalID);
            }
        }, delay);
    };

    /****************************************/
    /************AUXILIAR FUNCTIONS**********/
    /****************************************/
    
    var getClickPosition = function getClickPosition (e)
    {
        var parentPosition = getPosition(e.currentTarget);
        var xPosition = e.clientX - parentPosition.x;
        var yPosition = e.clientY - parentPosition.y;
        return {x: xPosition, y: yPosition};
    };

    var getPosition = function getPosition (element)
    {
        var xPosition = 0;
        var yPosition = 0;
        
        while (element) {
            xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
            yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
            element = element.offsetParent;
        }
        return {x: xPosition, y: yPosition};
    };

    var can_finish = function ()
    {
        return (points[actual].length > 2);  
    };
    
    var getPercentage = function (pos)
    {
        var py = canvas.clientHeight,
            px = canvas.clientWidth;
        var per1 = (pos.x / px) * 100,
            per2 = (pos.y / py) * 100;
        return {x: per1, y: per2};
    };

    var getPixels = function (pos)
    {
        var py = canvas.clientHeight,
            px = canvas.clientWidth;
        var per1 = (pos.x * px) / 100,
            per2 = (pos.y * py) / 100;
        return {x: per1, y: per2};
    };

    var create_circle = function (x, y)
    {
        var Div = document.createElement('div');
        Div.className = "circle";
        var percs = getPercentage({x:x-3,y:y-3});
        
        Div.style.left = percs.x + "%";
        Div.style.top = percs.y + "%"; 
        
        Div.id = "Dot" + actual + "_" + count[actual];
        return Div;
    };

    var add_redo = function (action, dot, params)
    {
        redos.push({action:action, dot:dot, params:params});
    };
    
    var add_action = function (action, dot, params)
    {
        actions.push({action:action, dot:dot, params:params});
        if (!redding)
        {
            redos = [];
        }
    };
    
    var reconnect_until_end = function (ac, type)
    {
        var uuid1 = "", uuid2="";
        for (var i=1; i<count[ac]; i++)
        {
            uuid1 = ac + "_" + (i-1);
            uuid2 = ac + "_" + i;
            instance.detachAllConnections("Dot" + uuid2);
            _addConnection(uuid1, uuid2, type);
        }
    };

    var parse_id = function (Id)
    {
        var regExpr = /(Dot)*(\d+)_(\d+)/g;
        var match = regExpr.exec(Id);
        if (match !== null)
        {
            return {f:match[2], s:match[3]};   
        }
        return null;
    };

    var mv_dot_to = function (el, pos)
    {
        el.style.left = pos.x + "%";
        el.style.top = pos.y + "%";
    };

    var move_action = function (Id, pos, add_f)
    {
        var ids = parse_id(Id);
        var el = document.getElementById(Id);
        if (_is_inside_limits(pos))
        {
            add_f(MOVE, Id, {pos:points[ids.f][ids.s]});
            points[ids.f][ids.s] = pos;
            mv_dot_to(el, pos);
            redraw();
        }
    };

    var all_set_draggable = function (value)
    {
        for (var i=0; i<actual; i++)
        {
            for (var j=0; j<count[i];j++)
            {
                instance.setDraggable("Dot"+i+"_"+j, value);
            }
        }
    };

    var change_class = function (c1, c2)
    {
        var els = $("." + c1);
        els.removeClass(c1);
        els.addClass(c2);
    };

    
    var stop_edit = function ()
    {
        if (actual === 0)
        {
            return;
        }
        if (count[actual] > 0)
        {
            clean_last_not_finished();
        }
        can_edit = false;
        all_set_draggable(false);
        change_class("circle", "circlenoedit");
        change_class("btn-success", "btn-danger");
        $("#toggle-edit").text("Not Editing");
        start();
        window.clearTimeout(timer);
        timer = undefined;
    };
    
    var start_edit = function ()
    {
        can_edit = true;
        all_set_draggable(true);
        change_class("circlenoedit", "circle");
        change_class("btn-danger", "btn-success");
        $("#toggle-edit").text("Editing");
    };


    /****************************************/
    /*************MAIN DRAW FUNCTIONS********/
    /****************************************/

    var _addConnection = function (first, second, type)
    {
        instance.connect({uuids:[first,second], type:type});
        instance.connect({uuids:[first,second], type:type+"-out"});
    };

    var _lastConnection = function (type)
    {
        var first = actual + "_0",
            last = actual + "_" + (points[actual].length - 1);
        _addConnection(first, last, type);
        add_action(FINISH, last, {x: actual});
    };
    
    var _closeColorPath = function ()
    {
        reconnect_until_end(actual, "close");
        _lastConnection("close");
    };

    var _addEndpoint = function (Id)
    {
        var ep = instance.addEndpoint("Dot"+Id, dot_endp, {uuid: Id});
        ep.setVisible(false);
    };

    var _addPoint = function (pos, Id)
    {
        points[actual].push(pos);
        add_action(ADD, Id, {pos:pos});
        if (timer)
        {
            window.clearTimeout(timer);
            timer = window.setTimeout(stop_edit,5000);
        }
    };

    var _finishPath = function ()
    {
        if (can_finish())
        {
            _closeColorPath();
            points.push([]);
            count.push(0);
            actual += 1;

            window.clearTimeout(timer);
            timer = window.setTimeout(stop_edit, 5000);
        }
    };
    
    var _is_inside_limits = function (pos)
    {
        var percs = getPercentage(pos);
        return (percs.x >= 0.0 && percs.x <= 100.0) &&
            (percs.y >= 0.0 && percs.y <= 100.0);
    };

    var _add_full_point = function (pos)
    {
        var percs = getPercentage(pos);
        var circle = create_circle(pos.x, pos.y);
        var Id = actual + "_" + count[actual];
        var preId = actual + "_" + (count[actual] - 1);
        canvas.appendChild(circle);
        _addEndpoint(Id);
        _addPoint(percs, Id);
        _addConnection(preId, Id, "open");
        count[actual] += 1;
        instance.draggable(jsPlumb.getSelector("#myCanvas .circle"), {grid: [1/canvas.clientHeight, 1/canvas.clientWidth], stop: _stopDrag});
    };

    var clean_last_not_finished = function ()
    {
        var id = "";
        var eid = "";
        for (var i=0; i<count[actual]; i++)
        {
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
    
    _stopDrag = function (e)
    {
        var pos = {x:e.pos[0],y:e.pos[1]};
        var ids = parse_id(e.el.id);
        if (_is_inside_limits(pos))
        {
            var percs = getPercentage(pos);
            var total_diff = (Math.abs(percs.x - points[ids.f][ids.s].x) + Math.abs(percs.y - points[ids.f][ids.s].y)) - 1.71;
            if (!((total_diff > 0) && (total_diff < 0.009)))
            {
                add_action(MOVE, e.el.id, {pos:points[ids.f][ids.s]});
                points[ids.f][ids.s] = percs;
                mv_dot_to(e.el, percs);
            }
        }
        else
        {
            var old_pos = points[ids.f][ids.s];
            mv_dot_to(e.el, old_pos);
        }
        redraw();
        dragging = true;
        window.setTimeout(function () {dragging = false;}, 200);
    };

    redo_action = function ()
    {
        var redo_add = function (Id, pos)
        {
            var p = getPixels(pos);
            _add_full_point(p);
        };
        var redo_move = function (Id, pos)
        {
            move_action(Id, pos, add_action);
        };
        var redo_finish = function (x)
        {
            _finishPath();
        };
        if (!can_edit)
        {
            window.console.log("Edit mode off");
            return;
        } 
        redding = true;
        var act = redos.pop(); //pop_and_push(redos, actions);
        if (act === undefined)
        {
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

    undo_action = function ()
    {
        var undo_add = function (Id, pos)
        {
            instance.detachAllConnections("Dot" + Id);
            instance.deleteEndpoint(Id);
            instance.remove("Dot"+Id);
            points[actual].pop();
            count[actual] -= 1;
            add_redo(ADD, Id, {pos:pos});
        };
        var undo_move = function (Id, pos)
        {
            move_action(Id, pos, add_redo);
        };
        var undo_finish = function (Id, x)
        {
            add_redo(FINISH, Id, {x:x});
            reconnect_until_end(x,"open");
            points.pop();
            count.pop();
            actual = x;
        };
        if (!can_edit)
        {
            window.console.log("Edit mode off");
            return;
        } 
        var act = actions.pop();
        if (act === undefined)
        {
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

    handle_edit = function (e)
    {
        if (can_edit)
        {
            stop_edit();
        }else
        {
            start_edit();
        }
    };

    /* click handler */
    handler = function handler (e)
    {
        if (!can_edit || (dragging && e.target.id !== "Dot" + actual + "_0"))
        {
            return;
        }
        if (e.target.id === "Dot" + actual + "_0")
        {
            _finishPath();
        }
        else if (e.target.id === "myCanvas")
        {
            var pos = getClickPosition(e);
            _add_full_point(pos);
        }
        redraw();
    };

    // Double click handler
    handler_dbl = function handler_dbl (e)
    {
        if (can_edit)
        {
            _finishPath();
        }
    };

    // Key press handler
    keyHandler = function (e)
    {
        var eobj = window.event ? window.event : e;
        if (can_edit && eobj.keyCode === 90 && eobj.ctrlKey && ! eobj.shiftKey)
        {
            undo_action();
        } else if (can_edit && eobj.keyCode === 90 && eobj.ctrlKey && eobj.shiftKey)
        {
            redo_action();
        }
    };
    
    return CrowdDetector;
    
})();
