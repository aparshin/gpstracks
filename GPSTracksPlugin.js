(function()
{
    var publicInterface = {
        afterViewer: function(params, map)
        {
            var DOMAIN = 'http://test.aparshin.ru:1337/';
            var checkTask = function(taskid) {
                var interval = setInterval(function() {
                    $.ajax(DOMAIN + "checktask?callback=?", {
                        dataType: 'jsonp',
                        data: {taskid: taskid},
                        success: function(response) {
                            if (response.state === 'done') {
                                clearInterval(interval);

                                var geoObjects = response.result;
                                
                                for (var i = 0; i < geoObjects.length; i++) {
                                    map.drawing.addObject({type: 'LINESTRING', coordinates: geoObjects[i].geometry.coordinates});
                                }
                                    
                            } else if (response.state === 'unknown') {
                                clearInterval(interval);
                            }
                        }
                    })
                }, 1000)
            }
            
            var canvas = $('<div/>');
            var dropZone = $('<div/>').css({'text-align': 'center', 'padding-top': '30%', 'font-size': '30px', height: '100px'})
                .text('Перетащите сюда GPS треки').appendTo(canvas);
                
            var preventDefaultHandler = function(evt) {
                evt.preventDefault();
                evt.stopPropagation();
            }

            dropZone[0].addEventListener("dragenter", preventDefaultHandler);
            dropZone[0].addEventListener("dragover",  preventDefaultHandler);
            dropZone[0].addEventListener("dragexit",  preventDefaultHandler);
            dropZone[0].addEventListener("drop", function (evt) {
                evt.preventDefault();
                evt.stopPropagation();
                
                var xhr = new XMLHttpRequest();
                
                xhr.onreadystatechange = function() {
                    if(this.readyState == this.DONE) {
                        checkTask(this.response);
                    }
                };
                
                xhr.open("POST", DOMAIN + "uploadgps", true);

                var formData = new FormData();
                var files = evt.dataTransfer.files;
                for (var f = 0; f < files.length; f++) {
                    formData.append('file', files[f]);
                }

                xhr.send(formData);
                
                return false;
            }, false)
            
            var menu = new leftMenu();
            menu.createWorkCanvas("aisdnd", function(){});
            _(menu.workCanvas, [canvas[0]], [['css', 'width', '100%']]);
        }
    };
    
    gmxCore.addModule('GPSTracksPlugin', publicInterface);
})();