const logger = require('../utils/logger');

class TaskService {
  constructor() {
    this.tasks = [];
  }

  create(data) {
    const task = { id: `TASK-${Date.now()}`, status: 'pending', ...data };
    this.tasks.push(task);
    return task;
  }

  update(id, updates) {
    const task = this.tasks.find(t => t.id === id);
    if (task) Object.assign(task, updates);
    return task;
  }

  getAll() {
    return this.tasks;
  }
}

module.exports = TaskService;
