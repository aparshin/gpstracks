var Q          = require('q'),
    _          = require('underscore'),

    express    = require('express'),
    cors       = require('cors'),
    multer     = require('multer'),
    bodyParser = require('body-parser'),

    TaskManager   = require('./TaskManager'),
    TracksManager = require('./TracksManager'),
    LinksManager  = require('./LinksManager');


var app = express();

app.use(cors());
app.use(multer({inMemory: true}));
app.use(bodyParser.urlencoded({extended: false}));

var taskManager = new TaskManager();

app.all('/uploadgps', function (req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(501).end(); 
    }

    var urls = [];
    
    if (req.query.url) {
        urls = urls.concat(urls, Array.isArray(req.query.url) ? req.query.url : [req.query.url]);
    }

    if (req.body.url) {
        urls = urls.concat(urls, Array.isArray(req.body.url) ? req.body.url : [req.body.url]);
    }

    var taskID = taskManager.addTask(function () {
        var sourceDefers = [],
            files = req.files && req.files.file,
            tracksManager = new TracksManager();

        if (files) {
            files = Array.isArray(files) ? files : [files];
        
            files.forEach(function (file) {
                if (file.fieldname === 'file') {
                    var sourceDesc = {filename: file.originalname, data: file.buffer};
                    sourceDefers.push(tracksManager.getFromSource(sourceDesc));
                }
            });
        }

        urls.forEach(function (source) {
            sourceDefers.push(tracksManager.getFromURL(source));
        });

        return Q.all(sourceDefers).then(_.flatten);
    });
    res.json(taskID);
});

app.get('/checktask', function (req, res) {
    var taskID = req.query.taskid;
    var resJSON = {state: taskManager.getTaskState(taskID)};
    if (resJSON.state === 'done') {
        // resJSON.result = _.pluck(taskManager.getTaskResult(taskID), 'geojson');
        resJSON.result = taskManager.getTaskResult(taskID);
        taskManager.removeTask(taskID);
    }
    res.jsonp(resJSON);
});

app.get('/gettracks', function (req, res) {
    var ids = req.query.id;
    if (!Array.isArray(ids)) {
        ids = [ids];
    }
    var tracksManager = new TracksManager();
    tracksManager.getTrackByIDs(ids).then(function(tracks) {
        res.jsonp(tracks);
    })
});

app.get('/loadlink', function(req, res) {
    var linksManager = new LinksManager();
    linksManager.load(req.query.id).then(function(msg) {
        res.jsonp(JSON.parse(msg));
    }, function() {
        res.jsonp('');
    })
});

app.post('/savelink', function(req, res) {
    var linksManager = new LinksManager();
    linksManager.save(req.body.msg).then(
        function(linkID) {
            res.json(linkID);
        }, function(){
            res.json();
        }
    )
});

app.listen(1337);
