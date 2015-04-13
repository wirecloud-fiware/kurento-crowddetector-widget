/*global $, beforeEach, beforeAll, describe, it, expect, affix, MashupPlatform, CrowdDetector, kurentoUtils*/


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
            // Remove the previous canvas
            $("#myCanvas").remove();
        });

        beforeEach(function () {
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


    describe("Test CrowdDetector widget", function () {
        var widget, values, prefsGetValues, contextGetValues;

        var async_interval = null;

        beforeAll(function () {
            // Remove the previous canvas
            $("#myCanvas").remove();
        });

        beforeEach(function () {

            prefsGetValues = {
                'server-url': 'ws://kurento.example.com',
                'use-camera': true,
                'file-path': 'notExist.mp4'
            };

            contextGetValues = {
                'username': ''
            };

            values = {
                "MashupPlatform.context.get": contextGetValues,
                "MashupPlatform.prefs.get": prefsGetValues
            };

            loadFixtures('index.html');
            MashupPlatform.prefs.registerCallback.calls.reset();
            MashupPlatform.wiring.registerCallback.calls.reset();
            kurentoUtils.withErrors = false;

            MashupPlatform.setStrategy(new MyStrategy(), values);

            // affix("#myCanvas");

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
            prefsGetValues['server-url'] = 'ws://kurento2.example.com';
            expect(prefsGetValues['server-url']).toBe('ws://kurento2.example.com');

            widget.loadPreferences();

            expect(widget.getUrl()).toBe(prefsGetValues['server-url']);
        });

        it("change the file path preference", function () {
            prefsGetValues['file-path'] = 'videos/otherFile.mp4';
            expect(prefsGetValues['file-path']).toBe('videos/otherFile.mp4');

            widget.loadPreferences();

            expect(widget.getFilePath()).toBe(prefsGetValues['file-path']);
        });

        it("change the 'use camera' preference", function () {
            proxylog(); // Prevent logs
            prefsGetValues['use-camera'] = false;
            expect(prefsGetValues['use-camera']).toBe(false);

            widget.loadPreferences();

            expect(widget.getUseCamera()).toBe(prefsGetValues['use-camera']);
        });

        it("Try get a video that don't exist", function(done) {
            proxylog(); // Prevent logs
            prefsGetValues['use-camera'] = false;
            expect(widget.getState()).toEqual(0); // Can start
            widget.loadPreferences();
            setTimeout(function() {
                expect(widget.getState()).toEqual(0); // Can start
                done();
            }, 200);
        });

        it("Try get a video that exist", function(done) {
            proxylog(); // Prevent logs

            prefsGetValues['use-camera'] = false;
            prefsGetValues['file-path'] = 'videos/exist.mp4';
            expect(widget.getState()).toEqual(0); // Can start
            widget.loadPreferences();
            setTimeout(function() {
                expect(widget.getState()).toEqual(3); // With video
                done();
            }, 2200);
        });
    });

    describe("Test events", function(){
        var widget, values, prefsGetValues, contextGetValues;
        var async_interval = null;
        beforeAll(function () {
            // Remove the previous canvas
            $("#myCanvas").remove();
        });
        beforeEach(function () {

            prefsGetValues = {
                'server-url': 'ws://kurento.example.com',
                'use-camera': true,
                'file-path': 'notExist.mp4'
            };

            contextGetValues = {
                'username': ''
            };

            values = {
                "MashupPlatform.context.get": contextGetValues,
                "MashupPlatform.prefs.get": prefsGetValues
            };

            loadFixtures('index.html');
            MashupPlatform.prefs.registerCallback.calls.reset();
            MashupPlatform.wiring.registerCallback.calls.reset();
            kurentoUtils.withErrors = false;

            MashupPlatform.setStrategy(new MyStrategy(), values);

            // affix("#myCanvas");
            widget = new CrowdDetector();
            widget.reset(); // I don't know why but new don't create a new instance u.U
        });

        afterEach(function () {
            widget.reset();
            restorelog(); // Restore the log function
            clearDocument();
            if (async_interval != null) {
                clearInterval(async_interval);
                async_interval = null;
            }
        });

        it("start and stop edit", function() {
            proxylog();
            expect(widget.getCanEdit()).toBeFalsy();
            widget.handle_edit(); // start
            expect(widget.getCanEdit()).toBeTruthy();
            widget.handle_edit(); // stop edit
            expect(widget.getCanEdit()).toBeTruthy(); // Still no points
        });
        it("don't let click if not editing", function(){
            widget.handler();
            expect($('.circle').length).toEqual(0);
        });
        it("can click and create a node if editting", function(){
            // canvasInit();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            expect($('.circle').length).toEqual(1);
        });
        it("other canvas id", function(){
            // canvasInit();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            t.target.id = 'notexists';
            widget.handler(t);
            expect($('.circle').length).toEqual(0);
        });
        it("multiples clicks!", function(){
            // canvasInit();
            widget.handle_edit(); // Start edit!
            var t = clickInit(10, 10, 0, 0);
            widget.handler(t);
            expect($('.circle').length).toEqual(1);

            t = clickInit(20, 20, 0, 0);
            widget.handler(t);
            expect($('.circle').length).toEqual(2);

            t = clickInit(30, 10, 0, 0);
            widget.handler(t);
            expect($('.circle').length).toEqual(3);
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
            widget.handler(t);
            expect(widget.getActual()).toBe(0);
        });
        it("finish clicking first", function(){
            // canvasInit();
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
            expect(widget.getActual()).toBe(1);
        });

        it("stop edit when can stop!", function(){
            proxylog();
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
            expect(widget.getActual()).toBe(1);

            widget.handle_edit();
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
        it("Two complex arrays distintct", function() {
            var a = [1, 2, [3, 4]];
            var b = [1, 2, [3, 5]];
            expect(a.equals(b)).toBeFalsy();
        });
    });
})();
