module.exports = function() {
    var taskArr = [],
        taskHash = {};

    var genTaskID = function() {
        var res = '';
        for (var k = 0; k < 4; k++) {
            res += Math.floor(Math.random()*1000).toString();
        }
        return 't' + res;
    }

    var runningTaskID = null;
    var runNextTask = function() {
        if (runningTaskID || !taskArr.length) return;

        var curTask = taskArr.shift();
        curTask.state = 'running';
        runningTaskID = curTask.id;
        
        curTask.func().done(function(result) {
            curTask.result = result;
            curTask.state = 'done';
            runningTaskID = null;
            runNextTask();
        })
    }

    this.addTask = function(processTaskFunc) {
        var taskID = genTaskID();
        var newTask = {
            id: taskID,
            state: 'pending', //pending, running, done
            result: null,
            func: processTaskFunc
        }

        taskHash[taskID] = newTask;
        taskArr.push(newTask);
        runNextTask();

        return taskID;
    }

    this.getTaskState = function(taskID) {
        return taskID in taskHash ? taskHash[taskID].state : 'unknown';
    }

    this.getTaskResult = function(taskID) {
        return taskID in taskHash ? taskHash[taskID].result : null;
    }

    this.removeTask = function(taskID) {
        delete taskHash[taskID];
        for (var i = 0; i < taskArr.length; i++) {
            if (taskArr[i].id === taskID) {
                taskArr.splice(i, 1);
                return;
            }
        }
    }
}
