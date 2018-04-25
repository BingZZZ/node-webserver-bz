var EventEmitter = require('events').EventEmitter;
var http = require('http');
var path = require('path');
var Util = require('util');
var ExpressApp = require('./app');

/**
 * Normalize a port into a number, string, or false.
 */
var normalizePort = function(val) {
	var port = parseInt(val, 10);
	if (isNaN(port)) {
		return val;
	}
	if (port >= 0) {
		return port;
	}
	return false;
}
//create webserver
function WebServer(config) {
	EventEmitter.call(this);
	this.port = config.port||3000;
	this.app = new ExpressApp(config);
	var that = this;
	this.app.on('error',function(error){
		that.emit('error',error);
	});
}
Util.inherits(WebServer, EventEmitter);
/*
 * start webserver
 */
WebServer.prototype.start = function(){
	this.server = server = http.createServer(this.app.get());
	this.server.on('error', this.onError.bind(this));
	this.server.on('listening', this.onListening.bind(this));
	this.server.listen(this.port);
}
/*
 * stop webserver
 */
WebServer.prototype.stop = function(){
	this.server.close();
}
/**
 * Event listener for HTTP server "error" event.
 */
WebServer.prototype.onError=function (error) {
	if (error.syscall !== 'listen') {
		throw error;
	}
	var port = normalizePort(this.port);
	var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
}
/**
 * Event listener for HTTP server "listening" event.
 */
WebServer.prototype.onListening=function () {
	var addr = this.server.address();
	var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
	console.log('Listening on ' + bind);
}
module.exports = WebServer;
