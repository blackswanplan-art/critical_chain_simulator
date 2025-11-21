// CCPM Drum-Buffer-Rope (DBR) Priority Queue
// Implements practical prioritization rules for task execution

class DrumBufferRope {
    constructor(tasks, resources, buffers, criticalChain) {
        this.tasks = new Map();
        this.resources = new Map();
        this.buffers = buffers || [];
        this.criticalChain = criticalChain || [];
        this.currentDay = 0; // Simulated current project day

        // Load data
        tasks.forEach(task => this.tasks.set(task.id, task));
        resources.forEach(resource => this.resources.set(resource.id, resource));

        // Build task lookup by resource
        this.tasksByResource = this.buildResourceTaskMap();
    }

    // Build map of resource -> tasks using that resource
    buildResourceTaskMap() {
        const map = new Map();

        this.resources.forEach((resource, resourceId) => {
            map.set(resourceId, []);
        });

        this.tasks.forEach(task => {
            if (task.resourceAssignments && task.resourceAssignments.length > 0) {
                task.resourceAssignments.forEach(assignment => {
                    if (map.has(assignment.resourceId)) {
                        map.get(assignment.resourceId).push(task);
                    }
                });
            }
        });

        return map;
    }

    // Main method: Get the next task for a specific resource
    // Returns the single highest-priority task this resource should work on
    getNextTaskForResource(resourceId) {
        const resource = this.resources.get(resourceId);
        if (!resource) return null;

        // Step 1: Get eligible tasks for this resource
        const eligible = this.getEligibleTasks(resourceId);

        if (eligible.length === 0) {
            return {
                task: null,
                reason: 'No eligible tasks',
                message: 'No tasks ready to start for this resource'
            };
        }

        // Step 2: Check if resource should start new task (multitasking prevention)
        const activeTask = this.getActiveTaskForResource(resourceId);
        if (activeTask) {
            return {
                task: activeTask,
                reason: 'Continue current task',
                message: `Finish "${activeTask.title}" before starting new work (No multitasking!)`,
                isActive: true
            };
        }

        // Step 3: Prioritize eligible tasks
        const prioritized = this.prioritizeTasks(eligible);

        // Return highest priority task
        const nextTask = prioritized[0];
        const priority = this.calculateTaskPriority(nextTask);

        return {
            task: nextTask,
            reason: this.getPriorityReason(nextTask, priority),
            message: `Start: "${nextTask.title}"`,
            priority: priority,
            bufferStatus: this.getTaskBufferStatus(nextTask)
        };
    }

    // Get all tasks eligible to start for a resource
    getEligibleTasks(resourceId) {
        const eligible = [];
        const resourceTasks = this.tasksByResource.get(resourceId) || [];

        resourceTasks.forEach(task => {
            // Task must meet all criteria:
            // 1. Not started yet
            if (task.status !== 'not_started') return;

            // 2. All predecessors complete
            if (!this.allPredecessorsComplete(task)) return;

            // 3. Within buffer protection window (ROPE mechanism)
            if (!this.isWithinBufferZone(task)) return;

            // 4. Scheduled to start by now (or soon)
            if (!this.isScheduledToStart(task)) return;

            eligible.push(task);
        });

        return eligible;
    }

    // Check if all predecessor tasks are complete
    allPredecessorsComplete(task) {
        if (!task.predecessors || task.predecessors.length === 0) {
            return true; // No predecessors
        }

        return task.predecessors.every(predId => {
            const pred = this.tasks.get(predId);
            return pred && pred.status === 'completed';
        });
    }

    // ROPE mechanism: Task can only start if within buffer protection window
    // This prevents starting tasks too early and creating WIP
    isWithinBufferZone(task) {
        // Find buffer protecting this task
        const buffer = this.getProtectingBuffer(task);

        if (!buffer) {
            return true; // No buffer protection = can start anytime
        }

        // Task can start if we're within the buffer window
        // Window = buffer insertion point - buffer size
        const bufferStart = buffer.insertionPoint - buffer.size;
        const taskScheduledStart = task.scheduledStart || task.earliestStart || 0;

        // Can start if current day is after buffer start
        return this.currentDay >= bufferStart;
    }

    // Check if task is scheduled to start by now
    isScheduledToStart(task) {
        const scheduledStart = task.scheduledStart || task.earliestStart || 0;

        // Allow tasks to start a few days early for flexibility
        const startWindow = 5; // days
        return this.currentDay >= (scheduledStart - startWindow);
    }

    // Find buffer protecting this task
    getProtectingBuffer(task) {
        // Check if task is on critical chain
        if (task.isCriticalChain) {
            // Protected by project buffer
            return this.buffers.find(b => b.type === 'project');
        }

        // Check if task is on a feeding chain
        if (task.isOnFeedingChain) {
            // Find feeding buffer that protects this task
            return this.buffers.find(b =>
                b.type === 'feeding' &&
                b.linkedTaskIds.includes(task.id)
            );
        }

        return null;
    }

    // Get buffer status for a task (for display)
    getTaskBufferStatus(task) {
        const buffer = this.getProtectingBuffer(task);
        if (!buffer) return null;

        return {
            bufferId: buffer.id,
            bufferType: buffer.type,
            status: buffer.status,
            penetration: buffer.penetration
        };
    }

    // Prioritize tasks using CCPM rules
    prioritizeTasks(tasks) {
        return tasks.sort((a, b) => {
            const priorityA = this.calculateTaskPriority(a);
            const priorityB = this.calculateTaskPriority(b);

            // Higher priority number = more urgent
            return priorityB.score - priorityA.score;
        });
    }

    // Calculate priority score for a task
    calculateTaskPriority(task) {
        let score = 0;
        const factors = [];

        // Factor 1: Buffer status (most important)
        const buffer = this.getProtectingBuffer(task);
        if (buffer) {
            if (buffer.status === 'red') {
                score += 1000;
                factors.push('RED buffer');
            } else if (buffer.status === 'yellow') {
                score += 500;
                factors.push('YELLOW buffer');
            } else {
                score += 100;
                factors.push('GREEN buffer');
            }

            // Add penetration as tiebreaker
            score += buffer.penetration;
        }

        // Factor 2: Critical chain (very high priority)
        if (task.isCriticalChain) {
            score += 800;
            factors.push('Critical Chain');
        }

        // Factor 3: Feeding chain (medium priority)
        if (task.isOnFeedingChain) {
            score += 200;
            factors.push('Feeding Chain');
        }

        // Factor 4: Float (less float = higher priority)
        const float = task.totalFloat || 0;
        if (float < Infinity) {
            score += Math.max(0, 100 - float); // Less float = higher score
            if (float < 5) factors.push(`Low Float (${float.toFixed(1)}d)`);
        }

        // Factor 5: Scheduled start (tasks past their start date are urgent)
        const scheduledStart = task.scheduledStart || task.earliestStart || 0;
        const daysLate = this.currentDay - scheduledStart;
        if (daysLate > 0) {
            score += daysLate * 10;
            factors.push(`${daysLate.toFixed(0)}d late`);
        }

        return {
            score: score,
            factors: factors
        };
    }

    // Get human-readable priority reason
    getPriorityReason(task, priority) {
        if (priority.factors.length === 0) {
            return 'Ready to start';
        }
        return priority.factors.join(' | ');
    }

    // Get current active task for resource (multitasking prevention)
    getActiveTaskForResource(resourceId) {
        const resourceTasks = this.tasksByResource.get(resourceId) || [];

        // Find any task in progress for this resource
        const activeTask = resourceTasks.find(task => task.status === 'in_progress');

        return activeTask || null;
    }

    // Get work queue for a resource (next 5-10 tasks)
    getResourceWorkQueue(resourceId, limit = 10) {
        const queue = [];
        const allTasks = this.tasksByResource.get(resourceId) || [];

        // Get all future tasks (not started or in progress)
        const futureTasks = allTasks.filter(task =>
            task.status === 'not_started' || task.status === 'in_progress'
        );

        // Sort by scheduled start
        futureTasks.sort((a, b) => {
            const startA = a.scheduledStart || a.earliestStart || 0;
            const startB = b.scheduledStart || b.earliestStart || 0;
            return startA - startB;
        });

        // Take first N tasks
        futureTasks.slice(0, limit).forEach(task => {
            const priority = this.calculateTaskPriority(task);
            const bufferStatus = this.getTaskBufferStatus(task);
            const canStart = this.allPredecessorsComplete(task) &&
                           this.isWithinBufferZone(task);

            queue.push({
                task: task,
                priority: priority,
                bufferStatus: bufferStatus,
                canStart: canStart,
                scheduledStart: task.scheduledStart || task.earliestStart,
                status: task.status
            });
        });

        // Re-sort by priority
        queue.sort((a, b) => b.priority.score - a.priority.score);

        return queue;
    }

    // Get summary of work across all resources
    getSystemWorkSummary() {
        const summary = {
            resources: [],
            totalTasks: this.tasks.size,
            notStarted: 0,
            inProgress: 0,
            completed: 0,
            blocked: 0
        };

        // Count task statuses
        this.tasks.forEach(task => {
            if (task.status === 'not_started') summary.notStarted++;
            else if (task.status === 'in_progress') summary.inProgress++;
            else if (task.status === 'completed') summary.completed++;
        });

        // For each resource, get their next task
        this.resources.forEach((resource, resourceId) => {
            const nextTask = this.getNextTaskForResource(resourceId);
            const queue = this.getResourceWorkQueue(resourceId, 5);

            summary.resources.push({
                id: resourceId,
                name: resource.name,
                icon: resource.getTypeIcon(),
                nextTask: nextTask,
                queueLength: queue.length,
                hasWork: queue.length > 0
            });
        });

        return summary;
    }

    // Simulate task handoff - called when a task completes
    signalTaskHandoff(completedTaskId) {
        const completedTask = this.tasks.get(completedTaskId);
        if (!completedTask) return [];

        const notifications = [];

        // Find all tasks that were waiting for this one
        this.tasks.forEach(task => {
            if (!task.predecessors || !task.predecessors.includes(completedTaskId)) return;
            if (task.status !== 'not_started') return;

            // Check if all predecessors are now complete
            if (this.allPredecessorsComplete(task)) {
                // Find resources assigned to this task
                if (task.resourceAssignments) {
                    task.resourceAssignments.forEach(assignment => {
                        const resource = this.resources.get(assignment.resourceId);
                        if (!resource) return;

                        notifications.push({
                            resourceId: assignment.resourceId,
                            resourceName: resource.name,
                            task: task,
                            message: `Task "${task.title}" is now ready to start`,
                            priority: task.isCriticalChain ? 'HIGH' : 'NORMAL'
                        });
                    });
                }
            }
        });

        return notifications;
    }

    // Update current day (for simulation/tracking)
    setCurrentDay(day) {
        this.currentDay = day;
    }

    // Check if resource should be working (has eligible tasks)
    shouldResourceBeWorking(resourceId) {
        const nextTask = this.getNextTaskForResource(resourceId);
        return nextTask.task !== null;
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DrumBufferRope };
}
