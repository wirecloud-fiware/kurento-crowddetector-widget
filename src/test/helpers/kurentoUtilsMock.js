window.kurentoUtils = (function () {

    "use strict";

    var kurentoUtils = {

        connection: jasmine.createSpyObj('connection', ['processSdpAnswer', 'dispose']),

        withErrors: false,

        WebRtcPeer: jasmine.createSpyObj('WebRtcPeer', ['startSendRecv'])

    };

    kurentoUtils.WebRtcPeer.startSendRecv.and.callFake(function () {
        if (kurentoUtils.withErrors) {
            arguments[3]('error');
        } else {
            arguments[2]('offerSdp', kurentoUtils.connection);
        }

        return kurentoUtils.connection;
    });

    /*
    var callback = kurentoUtils.WebRTCPeer.startSendRecv.calls.mostRecent().args[2];
        callback();*/

    return kurentoUtils;
})();
