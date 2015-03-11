/*global $, beforeEach, beforeAll, describe, it, expect, affix, MashupPlatform, CrowdDetector*/

describe("Test CrowdDetector widget", function () {
    "use strict";
    var widget, values, prefsGetValues, contextGetValues;

    beforeAll(function () {
        // Remove the previous canvas
        $("#myCanvas").remove();
    });

    beforeEach(function () {
        prefsGetValues = {
            'server-url': 'ws://url1',
            'use-camera': true,
            'file-path': 'notExist.mp4'
        };

        contextGetValues = {
            'username': 'user1'
        };

        values = {
            "MashupPlatform.context.get": contextGetValues,
            "MashupPlatform.prefs.get": prefsGetValues
        };

        MashupPlatform.setStrategy(new MyStrategy(), values);

        // affix("#myCanvas");

        widget = new CrowdDetector();
    });

    // it("canvas exists in DOM", function () {
    //     expect($("#myCanvas")).toBeInDOM();
    //     expect($("#myCanvas")).toBeEmpty();
    // });

    // it("canvas can be appended", function () {
    //     var canv = $("#myCanvas");
    //     expect(canv).toBeInDOM();
    //     expect(canv).toBeEmpty();
    //     $('<div id="notempty"></div>').appendTo(canv);
    //     expect(canv).not.toBeEmpty();
    // });

    // it("canvas reset every test", function () {
    //     var test = $("#myCanvas");
    //     expect(test).toBeInDOM();
    //     expect(test).toBeEmpty();
    // });


    it("load the given preferences correctly", function () {
	expect(widget.getUrl()).toBe(prefsGetValues['server-url']);

	prefsGetValues['server-url'] = 'ws://url2';

	widget.loadPreferences();

	expect(widget.getUrl()).toBe(prefsGetValues['server-url']);
    });

    it("test", function () {
        values = {
            "MashupPlatform.context.get": contextGetValues,
            "MashupPlatform.prefs.get": prefsGetValues
        };
        MashupPlatform.setStrategy(new MyStrategy(), values);

        widget.setCanvas({clientHeight: 322, clientWidth: 572 });

        var t = {clientX: 497, clientY: 110, currentTarget: {
            offsetLeft: 389, offsetTop: 51, scrollLeft: 0,
            scrollTop: 0, clientLeft: 0, clientTop: 0
        }};

        var t2 = widget.getClickPosition(t);

        // window.console.log(widget.getPercentage(t2).x);
        // window.console.log(t2.x);
        // window.console.log(t2.y);
    });
});
