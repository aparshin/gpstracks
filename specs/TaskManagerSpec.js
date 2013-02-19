var TaskManager = require('../TaskManager.js'),
    Q = require('q'),
    sinon = require('sinon');

var MockTask = function () {
    var def = Q.defer();
    this.process = sinon.spy(function () { return def.promise; });
    this.resolve = function (res) {
        def.resolve(res);
    };
};

describe('Task manager', function () {
    var taskManager = new TaskManager();
    var task1 = new MockTask();
    var taskId1 = taskManager.addTask(task1.process);

    it('should return task id', function () {
        expect(typeof taskId1).toBe('string');
        expect(taskId1.length).toBeGreaterThan(0);
    });

    it('should start task immidiatly', function () {
        expect(task1.process.called).toBeTruthy();
        expect(taskManager.getTaskState(taskId1)).toBe('running');
        expect(taskManager.getTaskResult(taskId1)).toBeNull();
    });

    var task2 = new MockTask();
    var taskId2 = taskManager.addTask(task2.process);

    it('should start tasks syncronously', function () {
        expect(task2.process.called).toBeFalsy();
        expect(taskManager.getTaskState(taskId2)).toBe('pending');
    });

    it('should store results of finished task', function (done) {
        task1.resolve(10);
        Q.nextTick(function () {
            expect(taskManager.getTaskState(taskId1)).toBe('done');
            expect(taskManager.getTaskResult(taskId1)).toBe(10);
            expect(taskManager.getTaskState(taskId2)).toBe('running');
            expect(task2.process.called).toBeTruthy();
            done();
        });
    });

    it('should identify not exist tasks', function () {
        expect(taskManager.getTaskState('notExistsID')).toBe('unknown');
    });

    it('should remove task results', function () {
        taskManager.removeTask(taskId1);
        expect(taskManager.getTaskResult(taskId1)).toBeNull();
    });
});
