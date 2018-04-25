var EventEmitter = require('events').EventEmitter;
var Util =require('util');
var http = require('http');
var path = require('path');
var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var multer = require('multer');
var webpackDevMiddleware = require('webpack-dev-middleware');
var webpackHotMiddleware = require('webpack-hot-middleware');
var webpack = require('webpack');


//ExpressApp class
function ExpressApp(config){
  EventEmitter.call(this);
  this.initConfig(config);
  this.initApp();
}

Util.inherits(ExpressApp, EventEmitter);
ExpressApp.prototype.initConfig = function(config){
  this.config = config;
  this.port = config.port||3000;
  this.serverRootPath = config.serverRoot||path.join(process.cwd(),'/server');
  this.webRootPath = config.webRoot||path.join(process.cwd(),'/webapp');
}
ExpressApp.prototype.initApp = function(){
  this.app = express();

  // bodyParser
  this.app.use(bodyParser.json());
  this.app.use(bodyParser.urlencoded({
    extended: true
  }));

  //file uploads
  this.app.use(multer({
    dest: path.join(this.serverRootPath, this.config.uploadPath||'./uploads')
  }));
  //cookie
  this.app.use(cookieParser());
  console.log(this.config);
  var webpackConfig = this.config.webpack
  if(webpackConfig) {
    const compiler = webpack(webpackConfig);
    //webpack 中间件
    this.app.use(webpackDevMiddleware(compiler, {
      publicPath: webpackConfig.output.publicPath,
      stats: { colors: true }
    }));

    this.app.use(webpackHotMiddleware(compiler));

  }
  //session
  var initSessionConfig = {
    key: 'A_SESSION_KEY',
    secret: 'SOMETHING_REALLY_HARD_TO_GUESS',
    resave: true,
    saveUninitialized: true,
    cookie: {
      path: '/',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30 * 12 //one year(ish)
    }
  };
  var sessionConfig = this.config.session;
  if(sessionConfig){
    //key for session
    if(sessionConfig.key){
      initSessionConfig.key = sessionConfig.key;
    }
    //RedisStore for session
    if(sessionConfig.redisStore){
      var redisStore = sessionConfig.redisStore;
      initSessionConfig.store = new RedisStore({
          host: redisStore.host||'127.0.0.1',
          port: redisStore.port||6379,
          ttl: redisStore.expires||60*60*24*30*12 //one year
      })
    }
    if(sessionConfig.cookie){
      initSessionConfig.cookie = sessionConfig.cookie;
    }
  }
  this.app.use(session(initSessionConfig));

  this.app.set('port', this.port);

  // view engine setup
  var viewRootPath = path.join(this.serverRootPath,this.config.viewPath||'/views');
  var viewEngine = this.config.viewEngine||'ejs'
  this.app.set('views', viewRootPath);
  this.app.set('view engine', viewEngine);

  //filter
  this.app.use(this.initFilter(this.config.filter))
  //controller
  this.app.use(this.initController(this.config.controller));
  //webroot
  this.app.use(express.static(this.webRootPath));
  this.app.use(function(req, res, next) {
    console.log(req.path + ' not found!');
    next();
  });
}
//init filter
ExpressApp.prototype.initFilter = function(filterConfig){
  var router = express.Router();
  var filterRootPath = path.join(this.serverRootPath, filterConfig.rootPath);
  //this.emit('error','filterRoot:'+filterRootPath);
    filterConfig.filters.forEach(function(filter) {
        var tmps = filter.handler.split('.');
        var closureData = {
            path: filter.path || new RegExp(filter.regPath),
            method: (filter.method || 'get').toLowerCase(),
            module: tmps[0],
            handler: tmps[1]
        };
        (function(filter) {
            router[filter.method](filter.path, function(req, res, next) {
                var filterModule = require(path.join(filterRootPath, filter.module));
                if (filterModule && filterModule[filter.handler] && typeof(filterModule[filter.handler]) === 'function') {
                    filterModule[filter.handler](req, res, function(err, result) {
                        if (err) {
                            this.emit('error',err);
                        } else {
                            next()
                        }
                    });
                } else {
                    next();
                }
            });
        })(closureData);
    });
  return router;
}
//init controller
ExpressApp.prototype.initController = function(controllerConfig){
  var router = express.Router();
  var controllerRootPath = path.join(this.serverRootPath, controllerConfig.rootPath);
        var that = this;
        controllerConfig.controllers.forEach(function(controller) {
            var closureData = {
                path: controller.path || new RegExp(controller.regPath),
                method: (controller.method || 'get').toLowerCase(),
                handler: controller.handler
            };

            (function(controller) {
                router[controller.method](controller.path, function(req, res, next) {
                    var controllerPath = controller.path,
                        controllerHandler = controller.handler,
                        moduleName, methodName;
                    if (controllerPath instanceof RegExp) {
                        var result = controllerPath.exec(req.path);
                        result.shift();
                        req.params = result;
                        controllerHandler = req.path.replace(controllerPath,controllerHandler);
                    }
                    var tmps = controllerHandler.split('.');
                    moduleName = tmps[0];
                    methodName = tmps[1];
                    //that.emit('error','reqPath:'+req.path+',moduleName:'+moduleName+',methodName:'+methodName);
                    var controllerModule = require(path.join(controllerRootPath, moduleName));
                    if (controllerModule && controllerModule[methodName] && typeof(controllerModule[methodName]) === 'function') {
                        controllerModule[methodName](req, res, function(err, result) {
                            if (err) {
                                that.emit('error',err);
                                ajaxReturn = {
                                  code:500,
                                  result:'服务器内部错误'
                                }
                            }else{
                                ajaxReturn =result;
                            }
                            res.send(ajaxReturn);
                        });
                    } else {
                        next();
                    }
                });
            })(closureData);
        });
  return router;
}
ExpressApp.prototype.get = function(){
    return this.app;
}
module.exports = ExpressApp;
