var http       = require('http'),
    url        = require('url'),
    Q          = require('q'),
    _          = require('underscore'),
    formidable = require('formidable'),

    TaskManager = require('./TaskManager'),
    TracksManager = require('./TracksManager');


var taskManager = new TaskManager();

http.createServer(function (request, response) {
    var parsedURL = url.parse(request.url, true);
    if (parsedURL.pathname === '/uploadgps')
    {
        if (request.method.toUpperCase() === "OPTIONS") {
 
            response.writeHead(
                "204",
                "No Content",
                {
                    "Access-control-allow-origin": '*',
                    "Access-control-allow-methods": "PUT, OPTIONS",
                    "Access-control-allow-headers": "content-type, accept, X-File-Name, X-File-Size, X-File-Type",
                    "Access-control-max-age": 10, // Seconds.
                    "Content-length": 0
                }
            );
 
            response.end();
            return;
        }
        
        response.writeHead(200, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
        });

        var tracksManager = new TracksManager();
        var form = new formidable.IncomingForm();
        var userSources = [], 
            URLSources = [];
        form.onPart = function (part) {
            if (part.name === 'file') {
                var fileData = new Buffer(0);
                part.on('data', function (data) {
                    fileData = Buffer.concat([fileData, data]);
                }).on('end', function () {
                    userSources.push({filename: part.filename, data: fileData});
                    //var def = tracksManager.addFromSource({filename: part.filename, data: fileData});
                    //sourceDefers.push(def);
                });
            } else if (part.name === 'url') {
                var urlData = '';
                part.on('data', function (data) {
                    urlData += data;
                }).on('end', function () {
                    URLSources.push(urlData);
                    //sourceDefers.push(tracksManager.addFromURL(urlData));
                });
            }
        };

        form.parse(request, function () {

            var taskID = taskManager.addTask(function () {
                var sourceDefers = [];

                _.each(userSources, function (source) {
                    sourceDefers.push(tracksManager.getFromSource(source));
                });

                _.each(URLSources, function (source) {
                    sourceDefers.push(tracksManager.getFromURL(source));
                });

                return Q.all(sourceDefers).then(_.flatten);
            });
            response.end(taskID);
        });
    } 
    else if (parsedURL.pathname === '/checktask') {
        response.writeHead(200, {
            'Content-Type': 'text/plain'
        });

        var taskID = parsedURL.query.taskid;
        var callback = parsedURL.query.callback;
        var res = {state: taskManager.getTaskState(taskID)};
        if (res.state === 'done') {
            res.result = _.pluck(taskManager.getTaskResult(taskID), 'geojson');
            taskManager.removeTask(taskID);
        }
        response.end(callback + '(' + JSON.stringify(res) + ')');
    }
}).listen(1337);
