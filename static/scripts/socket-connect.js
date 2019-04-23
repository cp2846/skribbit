window.addEventListener('load', function() {
    socket = io.connect('localhost:5050');
    window.addEventListener("beforeunload", function() {
	console.log("Close web socket");
	socket.close();
    });
});
