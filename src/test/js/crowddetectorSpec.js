/*global $, MashupPlatform, MockMP, CrowdDetector, kurentoUtils, beforeAll, afterAll*/


(function () {
    "use strict";

    var widget;
    var olog = window.console.log;

    jasmine.getFixtures().fixturesPath = 'src/test/fixtures/';

    var dependencyList = [
        'script',
        'div#jasmine-fixtures',
        'div.jasmine_html-reporter'
    ];

    var clearDocument = function clearDocument() {
        $('body > *:not(' + dependencyList.join(', ') + ')').remove();
    };

    var getWiringCallback = function getWiringCallback(endpoint) {
        var calls = MashupPlatform.wiring.registerCallback.calls;
        var count = calls.count();
        for (var i = count - 1; i >= 0; i--) {
            var args = calls.argsFor(i);
            if (args[0] === endpoint) {
                return args[1];
            }
        }
        return null;
    };

    var getWiringData = function() {
        var calls = MashupPlatform.wiring.pushEvent.calls;
        var count = calls.count();
        var res = {crowd_occupancy: [],
               crowd_fluidity: []};
        for (var i = count - 1; i >= 0; i--) {
            var args = calls.argsFor(i);
            var json = JSON.parse(args[1]);
            if(json.data.length == 2) {
                res[args[0]].push(json.data[1]);
            }
        }
        return res;
    };

    var buildPrefs = function buildPrefs(camera, path, url) {
        if (typeof camera == 'undefined')
            camera = true;
        if (typeof path == 'undefined')
            path = 'notExist.mp4';
        if (typeof url == 'undefined')
            url = 'ws://kurento.example.com';
        return {
            'server-url': url,
            'use-camera': camera,
            'file-path': path
        };
    };

    var prefsGetValues = buildPrefs();

    var contextGetValues = {
        'username': ''
    };

    var values = {
        "context.get": MockMP.strategy.dict(contextGetValues),
        "prefs.get": MockMP.strategy.dict(prefsGetValues)
    };


    var print = function print(x) {
        window.console.log(x);
    };

    var proxylog = function () {
        window.console.log = function () {};
    };
    var restorelog = function () {
        window.console.log = olog;
    };

    var canvasInit = function(x, y) {
        if (typeof(x) === 'undefined')
            x = 640;
        if (typeof(y) === 'undefined')
            y = 480;

        widget.setCanvas({clientHeight: y, clientWidth: x }); // 640x480 size
    };

    var clickInit = function (x, y, ofx, ofy) {
        if (typeof(ofx) === 'undefined')
            ofx = 300;
        if (typeof(ofy) === 'undefined')
            ofy = 100;

        return {'target': {'id': 'myCanvas'},
                clientX: x, clientY: y, currentTarget: { // The center
                    offsetLeft: ofx, offsetTop: ofy, scrollLeft: 0, // The offset of the video
                    scrollTop: 0, clientLeft: 0, clientTop: 0
                }};
    };


    describe("Test CrowdDetector click", function () {

        beforeAll(function () {
            window.MashupPlatform = new MockMP.MockMP(values);
        });

        beforeEach(function () {
            MashupPlatform.reset();
            widget = new CrowdDetector();
        });

        it("click in the center without offset", function () {
            canvasInit();
            var t = clickInit(320, 240, 0, 0);

            var percs = widget.getPercentage(widget.getClickPosition(t));

            expect(percs.x).toEqual(50);
            expect(percs.y).toEqual(50);
        });

        it("click in the center with offset", function () {
            canvasInit();
            var t = clickInit(620, 340);

            var percs = widget.getPercentage(widget.getClickPosition(t));

            expect(percs.x).toEqual(50);
            expect(percs.y).toEqual(50);
        });

        it("click in the border left", function () {
            canvasInit();
            var t = clickInit(0, 240, 0, 0);

            var t2 = widget.getClickPosition(t);
            var percs = widget.getPercentage(t2);

            expect(percs.x).toEqual(0);
            expect(percs.y).toEqual(50);
        });

        it("click out the left border", function () {
            canvasInit();
            var t = clickInit(0, 240, 10, 0); // set an x offset to be "out" the border

            var t2 = widget.getClickPosition(t);
            var percs = widget.getPercentage(t2);

            expect(percs.x).toBeLessThan(0);
            expect(percs.y).toEqual(50);
        });

        it("click in the border right ", function () {
            canvasInit();
            var t = clickInit(640, 240, 0, 0);

            var t2 = widget.getClickPosition(t);
            var percs = widget.getPercentage(t2);

            expect(percs.x).toEqual(100);
            expect(percs.y).toEqual(50);
        });

        it("click out the border right ", function () {
            canvasInit();
            var t = clickInit(640.1, 240, 0, 0); // So little difference

            var t2 = widget.getClickPosition(t);
            var percs = widget.getPercentage(t2);

            expect(percs.x).toBeGreaterThan(100);
            expect(percs.y).toEqual(50);
        });

        it("click in the border top", function () {
            canvasInit();
            var t = clickInit(320, 0, 0, 0);

            var t2 = widget.getClickPosition(t);
            var percs = widget.getPercentage(t2);

            expect(percs.x).toEqual(50);
            expect(percs.y).toEqual(0);
        });

        it("click out the left top", function () {
            canvasInit();
            var t = clickInit(320, 0, 0, 0.1); // set a minimum y offset to be "out" the border
            var t2 = widget.getClickPosition(t);
            var percs = widget.getPercentage(t2);

            expect(percs.x).toEqual(50);
            expect(percs.y).toBeLessThan(0);
        });

        it("click in the border bottom", function () {
            canvasInit();
            var t = clickInit(320, 480, 0, 0);

            var t2 = widget.getClickPosition(t);
            var percs = widget.getPercentage(t2);

            expect(percs.x).toEqual(50);
            expect(percs.y).toEqual(100);
        });

        it("click out the border bottom", function () {
            canvasInit();
            var t = clickInit(320, 480.1, 0, 0); // So little difference

            var t2 = widget.getClickPosition(t);
            var percs = widget.getPercentage(t2);

            expect(percs.x).toEqual(50);
            expect(percs.y).toBeGreaterThan(100);
        });
    });

    describe("Edit and click tests", function () {
        var widget;
        var check_three = function(actual, circle, circlenoedit) {
            expect(widget.getActual()).toBe(actual);
            expect($('.circle').length).toEqual(circle);
            expect($('.circlenoedit').length).toEqual(circlenoedit);
        };

        beforeEach(function () {
            loadFixtures('index.html');
            widget = new CrowdDetector();
        });

        afterEach(function () {
            widget.reset();
            restorelog();
            clearDocument();
        });

        it("start and stop edit", function() {
            proxylog();
            expect(widget.getCanEdit()).toBeFalsy();
            check_three(0, 0, 0);
            widget.handle_edit(); // start
            expect(widget.getCanEdit()).toBeTruthy();
            check_three(0, 0, 0);
            widget.handle_edit(); // stop edit
            expect(widget.getCanEdit()).toBeTruthy();
            check_three(0, 0, 0);
        });

        it("don't let click if not editing", function(){
            widget.handler();
            check_three(0, 0, 0);
        });

        it("can click and create a node if editting", function(){
            // canvasInit();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            check_three(0, 0, 0);
            widget.handler(t);
            check_three(0, 1, 0);
        });

        it("other canvas id", function(){
            // canvasInit();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            t.target.id = 'notexists';
            check_three(0, 0, 0);
            widget.handler(t);
            check_three(0, 0, 0);
        });

        it("multiples clicks!", function(){
            // canvasInit();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            check_three(0, 0, 0);
            widget.handler(t);
            check_three(0, 1, 0);

            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            check_three(0, 2, 0);

            t = clickInit(30, 10, 0, 0);
            widget.handler(t);
            check_three(0, 3, 0);
        });

        it("try finish with 2 nodes", function(){
            // canvasInit();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);

            t = clickInit(10, 10, 0, 0);
            t.target.id = 'Dot0_0';
            check_three(0, 2, 0);
            widget.handler(t);
            check_three(0, 2, 0);
        });

        it("finish clicking first", function(){
            // canvasInit();
            spyOn(window, 'setTimeout');
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            t = clickInit(30, 10, 0, 0);
            widget.handler(t);

            t = clickInit(10, 10, 0, 0);
            t.target.id = 'Dot0_0';

            check_three(0, 3, 0);
            widget.handler(t);
            check_three(1, 3, 0);
        });

        it("stop edit when can stop!", function(){
            proxylog();
            spyOn(window, 'setTimeout');
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            t = clickInit(30, 10, 0, 0);
            widget.handler(t);

            t = clickInit(10, 10, 0, 0);
            t.target.id = 'Dot0_0';
            widget.handler(t);
            check_three(1, 3, 0);

            widget.handle_edit();
            check_three(1, 0, 3);
        });

        it("doubleclick when no edit", function(){
            proxylog();
            spyOn(window, 'setTimeout');
            check_three(0,0,0);
            widget.handler_dbl();
            check_three(0, 0, 0);
        });

        it("finish with doubleclick", function(){
            proxylog();
            spyOn(window, 'setTimeout');
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            t = clickInit(30, 10, 0, 0);
            widget.handler(t);

            check_three(0,3,0);
            widget.handler_dbl();
            check_three(1, 3, 0);

            widget.handle_edit();
        });

        it("when stop, clean not finished!", function(){
            proxylog();
            spyOn(window, 'setTimeout');
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            t = clickInit(30, 10, 0, 0);
            widget.handler(t);

            t = clickInit(10, 10, 0, 0);
            t.target.id = 'Dot0_0';
            widget.handler(t);

            t = clickInit(50, 20, 0, 0);
            widget.handler(t);

            check_three(1, 4, 0);

            widget.handle_edit();
            check_three(1, 0, 3);
        });

    });

    describe("Undo and Redo tests", function () {
        var widget;
        var check_three = function(actual, circle, circlenoedit) {
            expect(widget.getActual()).toBe(actual);
            expect($('.circle').length).toEqual(circle);
            expect($('.circlenoedit').length).toEqual(circlenoedit);
        };

        beforeEach(function() {
            loadFixtures('index.html');
            widget = new CrowdDetector();
        });

        afterEach(function () {
            widget.reset();
            restorelog();
            clearDocument();
        });

        it("can't redo if not editting", function() {
            proxylog();
            check_three(0, 0, 0);

            widget.undo_action();
            check_three(0, 0, 0);

            widget.undo_action();
            check_three(0, 0, 0);

            widget.undo_action();
            check_three(0, 0, 0);

            widget.redo_action();
            check_three(0, 0, 0);
        });

        it("Try to undo and redo more than can", function() {
            proxylog();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            t = clickInit(30, 10, 0, 0);
            widget.handler(t);

            check_three(0, 3, 0);
            widget.undo_action();
            check_three(0, 2, 0);
            widget.undo_action();
            check_three(0, 1, 0);
            widget.undo_action();
            check_three(0, 0, 0);
            widget.undo_action();
            check_three(0, 0, 0);

            widget.redo_action();
            check_three(0, 1, 0);
            widget.redo_action();
            check_three(0, 2, 0);
            widget.redo_action();
            check_three(0, 3, 0);
            widget.redo_action();
            check_three(0, 3, 0);
        });

        it("redo and undo of add nodes", function () {
            proxylog();
            spyOn(window, 'setTimeout');
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            t = clickInit(30, 10, 0, 0);
            widget.handler(t);

            check_three(0, 3, 0);
            widget.undo_action();
            check_three(0, 2, 0);
            widget.undo_action();
            check_three(0, 1, 0);
            widget.undo_action();
            check_three(0, 0, 0);
            widget.redo_action();
            check_three(0, 1, 0);
            widget.redo_action();
            check_three(0, 2, 0);
            widget.redo_action();
            check_three(0, 3, 0);
        });

        it("redo and undo of finish path", function () {
            proxylog();
            spyOn(window, 'setTimeout');
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            t = clickInit(30, 10, 0, 0);
            widget.handler(t);

            t = clickInit(10, 10, 0, 0);
            t.target.id = 'Dot0_0';
            widget.handler(t);

            check_three(1, 3, 0);
            widget.undo_action();
            check_three(0, 3, 0);
            widget.undo_action();
            check_three(0, 2, 0);
            widget.redo_action();
            check_three(0, 3, 0);
            widget.redo_action();
            check_three(1, 3, 0);
        });

        it("redo and undo with keyhandler", function () {
            proxylog();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            t = clickInit(30, 10, 0, 0);
            widget.handler(t);

            var undoevent = {keyCode: 90, ctrlKey: true, shiftKey: false}; // C-z
            var redoevent = {keyCode: 90, ctrlKey: true, shiftKey: true};  // C-S-z

            check_three(0, 3, 0);
            widget.keyHandler(undoevent);
            check_three(0, 2, 0);
            widget.keyHandler(redoevent);
            check_three(0, 3, 0);
        });

        it("send event to keyhandler that don't exist", function () {
            proxylog();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            t = clickInit(30, 10, 0, 0);
            widget.handler(t);

            var randomevent = {keyCode: 90, ctrlKey: false, shiftKey: false}; // z

            check_three(0, 3, 0);
            widget.keyHandler(randomevent);
            check_three(0, 3, 0);
            widget.keyHandler(randomevent);
            check_three(0, 3, 0);
        });

        it("redo and undo of move node", function () {
            proxylog();
            var circles = [];
            widget.setCanvas({clientHeight: 480, clientWidth: 640,
                              appendChild: function(c) {
                                  circles.push(c);
                                  document.getElementById('myCanvas').appendChild(c);
                              }});
            spyOn(window, 'setTimeout');
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);

            var data = {pos: [315, 315],
                        el: $('#Dot0_0')[0]
                       };
            var old_left = parseFloat($('#Dot0_0')[0].style.top);
            widget.stopDrag(data);

            check_three(0, 1, 0);
            widget.undo_action();
            check_three(0, 1, 0);
            widget.redo_action();
            check_three(0, 1, 0);
        });

        it("close stopDrag inside limits", function(){
            var circles = [];
            widget.setCanvas({clientHeight: 480, clientWidth: 640,
                              appendChild: function(c) {
                                  circles.push(c);
                                  document.getElementById('myCanvas').appendChild(c);
                              }});
            widget.handle_edit();

            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);

            // Let's drag the second close! :)
            var data = {pos: [15, 15],
                        el: $('#Dot0_1')[0]
                       };
            var old_left = parseFloat($('#Dot0_1')[0].style.left);
            widget.stopDrag(data);
            var new_left = parseFloat($('#Dot0_1')[0].style.left);

            check_three(0, 2, 0);
            expect(new_left - old_left < 1.0).toBeTruthy();
        });

        it("long stopDrag inside limits", function(){
            var circles = [];
            widget.setCanvas({clientHeight: 480, clientWidth: 640,
                              appendChild: function(c) {
                                  circles.push(c);
                                  document.getElementById('myCanvas').appendChild(c);
                              }});
            widget.handle_edit();

            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);

            // Let's drag the second close! :)
            var data = {pos: [215, 215],
                        el: $('#Dot0_1')[0]
                       };
            var old_left = parseFloat($('#Dot0_1')[0].style.left);
            widget.stopDrag(data);
            var new_left = parseFloat($('#Dot0_1')[0].style.left);

            check_three(0, 2, 0);
            expect(new_left - old_left > 1.0).toBeTruthy();
        });


        it("long stopDrag outside limits", function(){
            var circles = [];
            widget.setCanvas({clientHeight: 480, clientWidth: 640,
                              appendChild: function(c) {
                                  circles.push(c);
                                  document.getElementById('myCanvas').appendChild(c);
                              }});
            widget.handle_edit();

            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);

            // Let's drag the second close! :)
            var data = {pos: [800, 800],
                        el: $('#Dot0_1')[0]
                       };
            var old_left = parseFloat($('#Dot0_1')[0].style.left);
            widget.stopDrag(data);
            var new_left = parseFloat($('#Dot0_1')[0].style.left);

            check_three(0, 2, 0);
            expect(new_left - old_left < 1.0).toBeTruthy();
        });

        it("try move_action outside limits", function () {
            var circles = [];
            widget.setCanvas({clientHeight: 480, clientWidth: 640,
                              appendChild: function(c) {
                                  circles.push(c);
                                  document.getElementById('myCanvas').appendChild(c);
                              }});
            widget.handle_edit();

            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            t = clickInit(20, 20, 0, 0);
            widget.handler(t);

            var old_left = parseFloat($('#Dot0_1')[0].style.left);
            widget.move_action("Dot0_1", {x: 1024, y: 1024});
            var new_left = parseFloat($('#Dot0_1')[0].style.left);

            check_three(0, 2, 0);
            expect(new_left - old_left < 1.0).toBeTruthy();
        });

        it("Correct parse_id", function() {
            expect(widget.parse_id("Dot0_1")).toEqual({f: '0', s: '1'});
            expect(widget.parse_id("Dot97_11")).toEqual({f: '97', s: '11'});
        });

        it("Bad parse_id", function() {
            expect(widget.parse_id("Dot0-0")).toBeNull();
            expect(widget.parse_id("Dot0_0a")).toBeNull();
        });

        it("hidePath", function() {
            widget.hidePath();
            expect($('#myCanvas')[0].className).toBe('hide');
        });

        it("showPath", function() {
            widget.hidePath();
            widget.showPath();
            expect($('#myCanvas')[0].className).toBe('');
        });

        it("Reset timer without timer", function () {
            widget.setTimer(null);
            widget.reset_timer();
            expect(widget.getTimer()).toBeNull();
        });

        it("Reset timer without timer", function () {
            widget.setTimer(null);
            widget.reset_timer();
            expect(widget.getTimer()).toBeNull();
        });

        it("Reset timer ", function () {
            var timeout = window.setTimeout(function() {
            }, 200);
            widget.setTimer(timeout);
            spyOn(window, 'clearTimeout');
            spyOn(window, 'setTimeout');

            widget.reset_timer();

            expect(window.clearTimeout).toHaveBeenCalledWith(timeout);
            expect(window.setTimeout).toHaveBeenCalled();

            window.clearTimeout(timeout);
        });

        it('setIntervalX works', function () {
            var itimes = 5;
            var funcs = {
                f: function () {
                },
                e:  function () {
                }
            };

            spyOn(window, 'setInterval').and.callFake(function(callback, delay) {
                for(var i=0; i<itimes; i++) {
                    callback();
                    expect(funcs.f).toHaveBeenCalled();
                }
            });

            spyOn(window, 'clearInterval');
            spyOn(funcs, 'f');
            spyOn(funcs, 'e');
            widget.setIntervalX(funcs.f, 100, itimes, funcs.e);
            expect(window.setInterval).toHaveBeenCalled();
            expect(window.clearInterval).toHaveBeenCalled();
            expect(funcs.e).toHaveBeenCalledWith();
        });
    });

    describe("Test events", function(){
        var widget;
        var oldShowSpinner = null;

        beforeAll(function() {
            window.MashupPlatform = new MockMP.MockMP(values);
        });

        var check_three = function(actual, circle, circlenoedit) {
            expect(widget.getActual()).toBe(actual);
            expect($('.circle').length).toEqual(circle);
            expect($('.circlenoedit').length).toEqual(circlenoedit);
        };

        beforeEach(function () {
            MashupPlatform.reset();  // Reset to the previous values!

            loadFixtures('index.html');

            kurentoUtils.withErrors = false;

            var generateSpy = function (element, method) {
                spyOn(document.getElementById(element), method);
            };

            generateSpy('videoInput', 'addEventListener');
            generateSpy('videoOutput', 'addEventListener');

            widget = new CrowdDetector();
            oldShowSpinner = oldShowSpinner || widget.getShowSpinner();
            widget.setShowSpinner(function() {
            });
        });

        afterEach(function () {
            // widget.setShowSpinner(oldShowSpinner);
            restorelog(); // Restore the log function
            clearDocument();
        });

        it("test canplay videoinput", function() {
            var vi = document.getElementById('videoInput');
            var vo = document.getElementById('videoOutput');
            var canplaylistener = vi.addEventListener.calls.argsFor(0)[1];
            canplaylistener();

            expect(vi.className).toBe('');
            expect(vo.className).toBe('hide');
        });

        it("test canplay videoinput and timeout", function() {
            var vi = document.getElementById('videoInput');
            var vo = document.getElementById('videoOutput');
            spyOn(window, 'setTimeout').and.callFake(function(callback, time){
                callback();
            });
            var canplaylistener = vi.addEventListener.calls.argsFor(0)[1];
            canplaylistener();

            expect(vi.className).toBe('');
            expect(vo.className).toBe('hide');
        });

        it("test canplay videoinput when can stop", function() {
            var vi = document.getElementById('videoInput');
            var vo = document.getElementById('videoOutput');
            spyOn(window, 'setTimeout').and.callFake(function(callback, time){
                callback();
            });

            widget.setState(1);
            expect(widget.getState()).toBe(1);

            widget.hidePath();
            expect($("#myCanvas")[0].className).toBe('hide');

            var canplaylistener = vi.addEventListener.calls.argsFor(0)[1];
            canplaylistener();

            expect(vi.className).toBe('');
            expect(vo.className).toBe('hide');
            expect($("#myCanvas")[0].className).toBe('');
        });

        it("test canplay callback videoOutput", function() {
            var vi = document.getElementById('videoInput');
            var vo = document.getElementById('videoOutput');
            var canplaylistener = vo.addEventListener.calls.argsFor(0)[1];
            canplaylistener();

            expect(vi.className).toBe('hide');
            expect(vo.className).toBe('');
        });

        it("new widget prefs", function() {
            MashupPlatform.prefs.registerCallback.and.callFake(function (callback) {
                callback();
            });
            widget = new CrowdDetector();
            expect(MashupPlatform.prefs.registerCallback).toHaveBeenCalled();
        });
    });

    describe("Array equals", function () {
        var widget;
        beforeEach(function (){
            widget = new CrowdDetector();
            Array.prototype.equals = widget.arrayequals;
        });
        it("No second array is false", function(){
            var a = [1, 2];
            expect(a.equals()).toBeFalsy();
        });
        it("Distinct lengths is false", function () {
            var a = [1];
            expect(a.equals([1, 2])).toBeFalsy();
        });
        it("two simple distint should be false", function() {
            var a = [1, 2];
            var b = [1, 3];
            expect(a.equals(b)).toBeFalsy();
        });
        it("two simple equals return true", function() {
            var a = [1, 2];
            var b = [1, 2];
            expect(a.equals(b)).toBeTruthy();
        });
        it("Two complex arrays equals", function() {
            var a = [1, 2, [3, 4]];
            var b = [1, 2, [3, 4]];
            expect(a.equals(b)).toBeTruthy();
        });
        it("Two complex arrays distinct", function() {
            var a = [1, 2, [3, 4]];
            var b = [1, 2, [3, 5]];
            expect(a.equals(b)).toBeFalsy();
        });
    });

    describe("Test CrowdDetector widget", function () {
        var widget, values, prefsGetValues, contextGetValues;

        var async_interval = null;


        prefsGetValues = buildPrefs();

        contextGetValues = {
            'username': ''
        };

        values = {
            "context.get": MockMP.strategy.dict(contextGetValues),
            "prefs.get": MockMP.strategy.dict(prefsGetValues)
        };

        beforeAll(function () {
            window.MashupPlatform = new MockMP.MockMP(values);
        });

        beforeEach(function () {
            MashupPlatform.reset();
            loadFixtures('index.html');

            kurentoUtils.withErrors = false;

            widget = new CrowdDetector();
        });

        afterEach(function () {
            restorelog(); // Restore the log function
            clearDocument();
            if (async_interval != null) {
                clearInterval(async_interval);
                async_interval = null;
            }
        });

        it("registered preferences callback", function () {
            expect(MashupPlatform.prefs.registerCallback).toHaveBeenCalledWith(jasmine.any(Function));
        });

        it("load the initial preferences correctly", function () {
            expect(widget.getUrl()).toBe(prefsGetValues['server-url']);
            expect(widget.getUseCamera()).toBe(prefsGetValues['use-camera']);
            expect(widget.getFilePath()).toBe(prefsGetValues['file-path']);
        });

        it("change the url preference", function () {
            proxylog(); // Prevent logs
            var newurl = 'ws://kurento2.example.com';

            expect(MashupPlatform.prefs.get('server-url')).toBe('ws://kurento.example.com');
            expect(widget.getUrl()).toBe('ws://kurento.example.com');

            MashupPlatform.prefs.set('server-url', newurl);

            expect(MashupPlatform.prefs.get('server-url')).toBe(newurl);
            expect(widget.getUrl()).toBe(newurl);
        });

        it("change the file path preference", function () {
            proxylog(); // Prevent logs
            var newfile = 'videos/otherFile.mp4';

            expect(MashupPlatform.prefs.get('file-path')).toBe('notExist.mp4');
            expect(widget.getFilePath()).toBe('notExist.mp4');

            MashupPlatform.prefs.set('file-path', newfile);

            expect(MashupPlatform.prefs.get('file-path')).toBe(newfile);
            expect(widget.getFilePath()).toBe(newfile);
        });

        it("change the 'use camera' preference", function () {
            proxylog(); // Prevent logs

            expect(MashupPlatform.prefs.get('use-camera')).toBe(true);
            expect(widget.getUseCamera()).toBe(true);

            MashupPlatform.prefs.set('use-camera', false);

            expect(MashupPlatform.prefs.get('use-camera')).toBe(false);
            expect(widget.getUseCamera()).toBe(false);
        });

        it("Try get a video that don't exist", function(done) {
            proxylog(); // Prevent logs
            var newprefs = buildPrefs(false);
            MashupPlatform.setStrategy({'prefs.get': MockMP.strategy.dict(newprefs)});

            widget = new CrowdDetector();

            expect(widget.getState()).toEqual(0); // Can start

            setTimeout(function() {
                expect(widget.getState()).toEqual(0); // Can start
                done();
            }, 200);
        });

        it("Try get a video that exist", function(done) {
            proxylog(); // Prevent logs
            var newprefs = buildPrefs(false, 'videos/exist.mp4');
            MashupPlatform.setStrategy({'prefs.get': MockMP.strategy.dict(newprefs)});

            widget = new CrowdDetector();

            expect(widget.getState()).toEqual(0); // Can start

            setTimeout(function() {
                expect(widget.getState()).toEqual(3); // With video
                done();
            }, 2200);
        });

        it("Try get a video that exist with filter", function(done) {
            proxylog(); // Prevent logs

            var newprefs = buildPrefs(false, 'videos/exist.mp4');
            MashupPlatform.setStrategy({'prefs.get': MockMP.strategy.dict(newprefs)});

            widget = new CrowdDetector();

            expect(widget.getState()).toEqual(0); // Can start

            setTimeout(function() {
                expect(widget.getState()).toEqual(3); // With video

                widget.handle_edit(); // Start edit!
                var t = clickInit(10, 10, 0, 0);
                widget.handler(t);
                t = clickInit(20, 20, 0, 0);
                widget.handler(t);
                t = clickInit(30, 10, 0, 0);
                widget.handler(t);

                t = clickInit(10, 10, 0, 0);
                t.target.id = 'Dot0_0';
                widget.handler(t);
                widget.handle_edit();

                expect(widget.getState()).toEqual(0); // With video

                setTimeout(function () {
                    expect(widget.getState()).toEqual(1); // With video
                    done();
                }, 30);

            }, 2200);
        });

        it("Try get a video that exist with filter and we get wiring data", function(done) {
            proxylog(); // Prevent logs
            var newprefs = buildPrefs(false, 'all.mp4');
            MashupPlatform.setStrategy({'prefs.get': MockMP.strategy.dict(newprefs)});

            widget = new CrowdDetector();

            expect(widget.getState()).toEqual(0); // Can start

            setTimeout(function() {
                expect(widget.getState()).toEqual(3); // With video

                widget.handle_edit(); // Start edit!
                var t = clickInit(10, 10, 0, 0);
                widget.handler(t);
                t = clickInit(20, 20, 0, 0);
                widget.handler(t);
                t = clickInit(30, 10, 0, 0);
                widget.handler(t);

                t = clickInit(10, 10, 0, 0);
                t.target.id = 'Dot0_0';
                widget.handler(t);
                widget.handle_edit();

                expect(widget.getState()).toEqual(0); // With video

                setTimeout(function () {
                    expect(widget.getState()).toEqual(1); // With video
                    expect(MashupPlatform.wiring.pushEvent).toHaveBeenCalled(); // Because of initalization
                    MashupPlatform.wiring.pushEvent.calls.reset();
                    widget.send_all_wiring();
                    expect(MashupPlatform.wiring.pushEvent).toHaveBeenCalled();
                    var d = getWiringData();
                    expect(d.crowd_occupancy.length).toBe(1);
                    expect(d.crowd_fluidity.length).toBe(1);
                    expect(d.crowd_occupancy[0]).toEqual(['0',30]);
                    expect(d.crowd_fluidity[0]).toEqual(['0',30]);

                    done();
                }, 30);

            }, 3000);
        });
    });

})();
