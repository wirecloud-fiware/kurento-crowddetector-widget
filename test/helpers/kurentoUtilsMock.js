window.kurentoUtils = (function () {

    "use strict";

    var kurentoUtils = {

        connection: jasmine.createSpyObj('connection', ['processSdpAnswer', 'dispose', 'pc']),

        withErrors: false,

        WebRtcPeer: jasmine.createSpyObj('WebRtcPeer', ['startSendRecv', 'startRecvOnly', 'start'])
    };

    var pc = {
        getRemoteStreams: jasmine.createSpy('getRemoteStreams')
    };

    kurentoUtils.WebRtcPeer.startSendRecv.and.callFake(function () {
        if (kurentoUtils.withErrors) {
            arguments[3]('error');
        } else {
            arguments[2]('offerSdp', kurentoUtils.connection);
        }

        return kurentoUtils.connection;
    });

    kurentoUtils.WebRtcPeer.startRecvOnly.and.callFake(function () {
        if (kurentoUtils.withErrors) {
            arguments[2]('error');
        } else {
            arguments[1]('offerSdp');
        }
        return kurentoUtils.connection;
    });

    kurentoUtils.WebRtcPeer.start.and.callFake(function () {
        if (kurentoUtils.withErrors) {
            arguments[4]('error');
        } else {
            arguments[3]('offerSdp');
        }
        return kurentoUtils.connection;
    });

    kurentoUtils.connection.pc = pc;

    // kurentoUtils.connection.pc.and.callFake(function() {
    //     return pc;
    // });

    pc.getRemoteStreams.and.callFake(function() {
        return ["My stream"];
    });

    /*
    var callback = kurentoUtils.WebRTCPeer.startSendRecv.calls.mostRecent().args[2];
        callback();*/

    return kurentoUtils;
})();
