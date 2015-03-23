/*global $, beforeEach, beforeAll, describe, it, expect, affix, MashupPlatform, CrowdDetector, kurentoUtils*/


(function () {
    "use strict";

    // jasmine.getFixtures().fixturesPath = 'src/test/fixtures/';

    var dependencyList = [
        'script',
        'div#jasmine-fixtures',
        'div.jasmine_html-reporter'
    ];

    var widget;

    var print = function print(x) {
        window.console.log(x);
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

        return {clientX: x, clientY: y, currentTarget: { // The center
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

            MashupPlatform.prefs.registerCallback.calls.reset();
            MashupPlatform.wiring.registerCallback.calls.reset();
            kurentoUtils.withErrors = false;

            MashupPlatform.setStrategy(new MyStrategy(), values);

            // affix("#myCanvas");

            widget = new CrowdDetector();
        });

        it("load the given preferences correctly", function (done) {
	    expect(widget.getUrl()).toBe(prefsGetValues['server-url']);

	    prefsGetValues['server-url'] = 'ws://kurento2.example.com';

	    widget.loadPreferences();

	    expect(widget.getUrl()).toBe(prefsGetValues['server-url']);
            done();
            // window.setTimeout(function() {
            //     done();
            // }, 1000);
        });
    });
})();
