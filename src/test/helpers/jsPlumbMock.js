window.jsPlumb = (function () {
    "use strict";
    var endpoints = {};

    var jsPlumb = {
        ready: jasmine.createSpy('ready'),
        getInstance: jasmine.createSpy('getInstance'),
        getSelector: jasmine.createSpy('getSelector')
    };

    var instance = {
        registerConnectionTypes: jasmine.createSpy('registerConnectionTypes'),
        reset: jasmine.createSpy('reset'),
        repaintEverything: jasmine.createSpy('repaintEverything'),
        'addEndpoint': jasmine.createSpy('addEndpoint'),
        'deleteEndpoint': jasmine.createSpy('deleteEndpoint'),
        'remove': jasmine.createSpy('remove'),
        'connect': jasmine.createSpy('connect'),
        'draggable': jasmine.createSpy('draggable'),
        'detachAllConnections': jasmine.createSpy('detachAllConnections'),
        'setDraggable': jasmine.createSpy('setDraggable')
    };

    var endpoint = {
        'setVisible': jasmine.createSpy('setVisible')
    };

    jsPlumb.ready.and.callFake(function (f) {
        f();
    });

    jsPlumb.getInstance.and.callFake(function(opts) {
        return instance;
    });

    instance.addEndpoint.and.callFake(function(name, endp, uuid){
        // window.console.log(name, uuid.uuid);
        endpoints[uuid.uuid] = name;
        return endpoint;
    });

    instance.remove.and.callFake(function(e) {
        document.getElementById('myCanvas').removeChild(document.getElementById(e));
    });

    instance.connect.and.callFake(function(obj){
        // window.console.log(obj.uuids, obj.type);
    });
    // instance.registerConnectionTypes.and.callFake(function(sets) {});

    // instance.reset.and.callFake(function() {});

    return jsPlumb;
})();
