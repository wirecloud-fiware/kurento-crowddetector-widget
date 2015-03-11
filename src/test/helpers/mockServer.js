var mockServer1 = new MockServer('ws://url1');
var mockServer2 = new MockServer('ws://url2');
window.WebSocket = MockSocket;