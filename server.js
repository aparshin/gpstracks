var http       = require('http'),
    url        = require('url'),
    formidable = require('formidable'),

    TaskManager = require('./TaskManager'),
    TrackParserManager = require('./TrackParserManager');


var taskManager = new TaskManager();

http.createServer(function (request, response) {
    var parsedURL = url.parse(request.url, true);
    if (parsedURL.pathname === '/uploadgps')
    {
        if (request.method.toUpperCase() === "OPTIONS"){
 
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

        var trackParser = new TrackParserManager();
        var form = new formidable.IncomingForm();
        form.onPart = function(part) {
            if (part.name === 'file') {
                var fileData = new Buffer(0);
                part.on('data', function(data) {
                    fileData = Buffer.concat([fileData, data]);
                }).on('end', function() {
                    trackParser.addTrack(part.filename, fileData);
                })
            } 
            else if (part.name === 'url') {
                var urlData = '';
                part.on('data', function(data) {
                    urlData += data;
                }).on('end', function() {
                    trackParser.addTrack('', urlData, 'url');
                })
            }
        }

        form.parse(request, function() {
            var taskID = taskManager.addTask(trackParser.process);
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
        if (res.state === 'done' ) {
            res.result = taskManager.getTaskResult(taskID);
            taskManager.removeTask(taskID);
        }
        response.end( callback + '(' + JSON.stringify(res) + ')' );
    }
}).listen(1337);
