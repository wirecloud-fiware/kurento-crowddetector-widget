window.jsPlumb = (function () {
    "use strict";

    var jsPlumb = {
        ready: jasmine.createSpy('ready'),
        getInstance: jasmine.createSpy('getInstance')
    };

    var instance = {
        registerConnectionTypes: jasmine.createSpy('registerConnectionTypes'),
        reset: jasmine.createSpy('reset')
    };

    jsPlumb.ready.and.callFake(function (f) {
        f();
    });

    jsPlumb.getInstance.and.callFake(function(opts) {
        return instance;
    });

    // instance.registerConnectionTypes.and.callFake(function(sets) {});

    // instance.reset.and.callFake(function() {});

    return jsPlumb;
})();
