(function () {
    "use strict";

    window.mockServer2 = new MockServer('ws://kurento2.example.com');
    window.mockServer = new MockServer('ws://kurento.example.com');
    window.mockServer.on('connection', function (server) {
        server.on('message', function (event) {
            var data = JSON.parse(event.data);

            switch (data.id) {
            case "getVideo":
                if (data.url === "notExist.mp4") {
                    server.send(JSON.stringify({
                        id: 'getVideo',
                        accepted: false,
                        response: "can't send",
                        message: "File notExist.mp4 not found or can't resolve."
                    }));
                } else {
                    server.send(JSON.stringify({
                        id: 'getVideo',
                        accepted: true,
                        response: 'accepted',
                        filter: false,
                        sdpAnswer: "testsdp"
                    }));
                }
                break;
            case "start":
                window.console.log("start");
                break;
            case "stop":
                window.console.log("stop");
                break;
            default:
            }
        });
    });

    window.WebSocket = MockSocket;
})();
