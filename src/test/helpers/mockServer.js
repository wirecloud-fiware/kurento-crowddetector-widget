(function () {
    "use strict";

    var sf = false;
    var sd = false;
    var so = false;

    var send_data = function(server, id, data) {
        server.send(JSON.stringify({
            id: id,
            event_data: JSON.stringify(data)
        }));
    };

    var send_fluid = function(server) {
        if (!sf) {
            send_data(server, 'crowdDetectorFluidity', {
                roiID: 'roi1',
                fluidityPercentage: 30,
                fluidityLevel: 2});
            sf = true;
        }
    };

    var send_direct = function(server) {
        if (!sd) {
            send_data(server, 'crowdDetectorDirection', {
                roiID: 'roi1',
                directionAngle: 30});
            sd = true;
        }

    };

    var send_occup = function(server) {
        if (!so) {
            send_data(server, 'crowdDetectorOccupancy', {
                roiID: 'roi1',
                occupancyPercentage: 30,
                occupancyLevel: 2});
            so = true;
        }
    };

    var send_all = function(server) {
        send_fluid(server);
        send_direct(server);
        send_occup(server);
    };

    window.mockServer2 = new MockServer('ws://kurento2.example.com');
    window.mockServer2.on('connection', function (server) {
        server.on('message', function (event) {});
    });

    window.mockServer = new MockServer('ws://kurento.example.com');
    window.mockServer.on('connection', function (server) {
        server.on('message', function (event) {
            var data = JSON.parse(event);

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
                        filter: data.dots.length > 0,
                        sdpAnswer: "testsdp"
                    }));
                    if (data.dots.length > 0) { // Events emulation
                        switch(data.url) {
                        case "fluidity.mp4":
                            send_fluid(server);
                            break;
                        case "direction.mp4":
                            send_direct(server);
                            break;
                        case "occupancy.mp4":
                            send_occup(server);
                            break;
                        case "all.mp4":
                            send_all(server);
                            break;
                        }
                    }
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
