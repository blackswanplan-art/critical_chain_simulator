// CCPM Scheduling Engine - Resource-Constrained Critical Path Scheduling
// Implements Theory of Constraints scheduling with resource leveling and late-start

class CCPMScheduler {
    constructor(tasks, resources) {
        this.tasks = new Map(); // taskId -> task object
        this.resources = new Map(); // resourceId -> resource object
        this.taskGraph = new Map(); // taskId -> node with scheduling info
        this.criticalChain = [];
        this.feedingChains = [];
        this.projectDuration = 0;
        this.resourceCalendar = new Map(); // resourceId -> Map(day -> hoursUsed)

        // Load tasks and resources
        tasks.forEach(task => this.tasks.set(task.id, task));
        resources.forEach(resource => this.resources.set(resource.id, resource));
    }

    // Main scheduling algorithm - orchestrates all passes
    calculateSchedule() {
        console.log('CCPM Scheduler: Starting resource-constrained scheduling...');

        // Step 1: Build dependency graph and initialize task nodes
        this.buildDependencyGraph();

        // Step 2: Calculate early dates (forward pass with resource checking)
        this.forwardPass();

        // Step 3: Calculate late dates (backward pass)
        this.backwardPass();

        // Step 4: Calculate float/slack
        this.calculateFloat();

        // Step 5: Identify resource-constrained critical chain
        this.identifyCriticalChain();

        // Step 6: Identify feeding chains
        this.identifyFeedingChains();

        // Step 7: Resource leveling (resolve conflicts)
        this.levelResources();

        // Step 8: Apply late-start scheduling
        this.applyLateStartScheduling();

        console.log(`CCPM Scheduler: Complete. Project duration: ${this.projectDuration} days`);
        console.log(`Critical chain tasks: ${this.criticalChain.length}`);

        return {
            criticalChain: this.criticalChain,
            feedingChains: this.feedingChains,
            projectDuration: this.projectDuration,
            taskGraph: this.taskGraph
        };
    }

    // Step 1: Build dependency graph with successors
    buildDependencyGraph() {
        // Initialize all task nodes
        this.tasks.forEach((task, taskId) => {
            this.taskGraph.set(taskId, {
                task: task,
                duration: task.ccpmDuration,
                earliestStart: 0,
                earliestFinish: 0,
                latestStart: Infinity,
                latestFinish: Infinity,
                totalFloat: Infinity,
                freeFloat: 0,
                isCriticalChain: false,
                isOnFeedingChain: false,
                resourceConflicts: []
            });
        });

        // Build successor relationships
        this.tasks.forEach((task, taskId) => {
            const node = this.taskGraph.get(taskId);
            node.predecessors = task.predecessors || [];
            node.successors = [];

            // Find all tasks that depend on this task
            this.tasks.forEach((otherTask, otherTaskId) => {
                if (otherTask.predecessors && otherTask.predecessors.includes(taskId)) {
                    node.successors.push(otherTaskId);
                }
            });
        });
    }

    // Step 2: Forward Pass - Calculate Earliest Start/Finish with resource checking
    forwardPass() {
        console.log('Forward pass: Calculating earliest dates with resource constraints...');

        // Topological sort to process tasks in dependency order
        const sorted = this.topologicalSort();

        sorted.forEach(taskId => {
            const node = this.taskGraph.get(taskId);
            const task = node.task;

            // Calculate earliest start based on predecessors
            if (node.predecessors.length === 0) {
                node.earliestStart = 0; // Start tasks begin immediately
            } else {
                // Start after all predecessors finish
                node.earliestStart = Math.max(
                    ...node.predecessors.map(predId => {
                        const predNode = this.taskGraph.get(predId);
                        return predNode ? predNode.earliestFinish : 0;
                    })
                );
            }

            // Check resource availability and push start if needed
            const resourceAvailableStart = this.findEarliestResourceAvailability(task, node.earliestStart);
            node.earliestStart = Math.max(node.earliestStart, resourceAvailableStart);

            // Calculate earliest finish
            node.earliestFinish = node.earliestStart + node.duration;

            // Reserve resources in calendar
            this.reserveResources(task, node.earliestStart, node.earliestFinish);
        });

        // Project duration is the latest finish of any task
        this.projectDuration = Math.max(...Array.from(this.taskGraph.values()).map(n => n.earliestFinish));
    }

    // Topological sort using Kahn's algorithm
    topologicalSort() {
        const sorted = [];
        const inDegree = new Map();
        const queue = [];

        // Calculate in-degree for each task
        this.taskGraph.forEach((node, taskId) => {
            inDegree.set(taskId, node.predecessors.length);
            if (node.predecessors.length === 0) {
                queue.push(taskId);
            }
        });

        // Process tasks with no dependencies first
        while (queue.length > 0) {
            const taskId = queue.shift();
            sorted.push(taskId);

            const node = this.taskGraph.get(taskId);
            node.successors.forEach(succId => {
                const currentDegree = inDegree.get(succId);
                inDegree.set(succId, currentDegree - 1);

                if (inDegree.get(succId) === 0) {
                    queue.push(succId);
                }
            });
        }

        // Check for circular dependencies
        if (sorted.length !== this.tasks.size) {
            console.warn('Warning: Circular dependencies detected in task graph');
        }

        return sorted;
    }

    // Find earliest time when all required resources are available
    findEarliestResourceAvailability(task, requestedStart) {
        if (!task.resourceAssignments || task.resourceAssignments.length === 0) {
            return requestedStart; // No resources needed
        }

        let candidateStart = requestedStart;
        let maxAttempts = 100; // Prevent infinite loops
        let attempts = 0;

        while (attempts < maxAttempts) {
            const conflicts = this.checkResourceConflicts(task, candidateStart, candidateStart + task.ccpmDuration);

            if (conflicts.length === 0) {
                // No conflicts - this start time works
                return candidateStart;
            }

            // Push start to after the latest conflicting task
            const maxConflictEnd = Math.max(...conflicts.map(c => c.end));
            candidateStart = maxConflictEnd;
            attempts++;
        }

        console.warn(`Could not resolve resource conflicts for task ${task.id} after ${maxAttempts} attempts`);
        return candidateStart;
    }

    // Check if resources are available during [start, end) period
    checkResourceConflicts(task, start, end) {
        const conflicts = [];

        task.resourceAssignments.forEach(assignment => {
            const resource = this.resources.get(assignment.resourceId);
            if (!resource) return;

            const dailyCapacity = resource.getMaxDailyHours();

            // Check each day in the task duration
            for (let day = Math.floor(start); day < Math.ceil(end); day++) {
                const dayLoad = this.getResourceLoadOnDay(assignment.resourceId, day);
                const requiredHours = assignment.hoursPerDay;

                if (dayLoad + requiredHours > dailyCapacity) {
                    // Overallocation - find conflicting tasks
                    const conflictingTasks = this.findTasksUsingResourceOnDay(assignment.resourceId, day);
                    conflictingTasks.forEach(ct => {
                        if (ct.id !== task.id && !conflicts.some(c => c.id === ct.id)) {
                            conflicts.push({
                                id: ct.id,
                                resourceId: assignment.resourceId,
                                day: day,
                                start: ct.earliestStart || 0,
                                end: ct.earliestFinish || ct.ccpmDuration
                            });
                        }
                    });
                }
            }
        });

        return conflicts;
    }

    // Get total resource hours used on a specific day
    getResourceLoadOnDay(resourceId, day) {
        if (!this.resourceCalendar.has(resourceId)) {
            return 0;
        }

        const dayKey = Math.floor(day);
        const calendar = this.resourceCalendar.get(resourceId);
        return calendar.get(dayKey) || 0;
    }

    // Find which tasks are using a resource on a specific day
    findTasksUsingResourceOnDay(resourceId, day) {
        const tasksOnDay = [];

        this.taskGraph.forEach((node, taskId) => {
            const task = node.task;
            const start = node.earliestStart;
            const end = node.earliestFinish;

            if (start <= day && day < end) {
                // Task is active on this day
                const usesResource = task.resourceAssignments &&
                    task.resourceAssignments.some(ra => ra.resourceId === resourceId);

                if (usesResource) {
                    tasksOnDay.push({ id: taskId, earliestStart: start, earliestFinish: end });
                }
            }
        });

        return tasksOnDay;
    }

    // Reserve resources in calendar for a task
    reserveResources(task, start, end) {
        if (!task.resourceAssignments) return;

        task.resourceAssignments.forEach(assignment => {
            if (!this.resourceCalendar.has(assignment.resourceId)) {
                this.resourceCalendar.set(assignment.resourceId, new Map());
            }

            const calendar = this.resourceCalendar.get(assignment.resourceId);

            // Reserve hours for each day
            for (let day = Math.floor(start); day < Math.ceil(end); day++) {
                const currentLoad = calendar.get(day) || 0;
                calendar.set(day, currentLoad + assignment.hoursPerDay);
            }
        });
    }

    // Step 3: Backward Pass - Calculate Latest Start/Finish
    backwardPass() {
        console.log('Backward pass: Calculating latest dates...');

        // Process tasks in reverse topological order
        const sorted = this.topologicalSort().reverse();

        sorted.forEach(taskId => {
            const node = this.taskGraph.get(taskId);

            if (node.successors.length === 0) {
                // End task - latest finish = project end
                node.latestFinish = this.projectDuration;
            } else {
                // Latest finish = earliest latest start of successors
                node.latestFinish = Math.min(
                    ...node.successors.map(succId => {
                        const succNode = this.taskGraph.get(succId);
                        return succNode ? succNode.latestStart : Infinity;
                    })
                );
            }

            // Calculate latest start
            node.latestStart = node.latestFinish - node.duration;
        });
    }

    // Step 4: Calculate Float/Slack
    calculateFloat() {
        this.taskGraph.forEach((node, taskId) => {
            // Total float = latest start - earliest start
            node.totalFloat = node.latestStart - node.earliestStart;

            // Free float = minimum successor ES - this task's EF
            if (node.successors.length > 0) {
                const minSuccES = Math.min(...node.successors.map(succId => {
                    const succNode = this.taskGraph.get(succId);
                    return succNode ? succNode.earliestStart : Infinity;
                }));
                node.freeFloat = minSuccES - node.earliestFinish;
            } else {
                node.freeFloat = node.totalFloat;
            }

            // Update task object
            node.task.totalFloat = node.totalFloat;
            node.task.freeFloat = node.freeFloat;
        });
    }

    // Step 5: Identify Resource-Constrained Critical Chain
    identifyCriticalChain() {
        console.log('Identifying resource-constrained critical chain...');

        // Critical chain = longest chain of dependent tasks (zero float) + resource contentions
        // Start from task(s) with latest finish = project end

        const endTasks = Array.from(this.taskGraph.values())
            .filter(node => node.latestFinish === this.projectDuration)
            .sort((a, b) => b.earliestFinish - a.earliestFinish);

        if (endTasks.length === 0) return;

        const chain = [];
        let currentNode = endTasks[0];

        // Walk backward through critical path
        while (currentNode) {
            chain.unshift(currentNode.task);
            currentNode.isCriticalChain = true;
            currentNode.task.isCriticalChain = true;

            if (currentNode.predecessors.length === 0) break;

            // Find critical predecessor (zero float or resource-driven)
            let nextNode = null;
            let maxFinish = -1;

            currentNode.predecessors.forEach(predId => {
                const predNode = this.taskGraph.get(predId);
                if (!predNode) return;

                // Prefer tasks that directly determine this task's start
                if (predNode.earliestFinish === currentNode.earliestStart) {
                    if (predNode.earliestFinish > maxFinish) {
                        maxFinish = predNode.earliestFinish;
                        nextNode = predNode;
                    }
                }
            });

            // If no direct predecessor, look for resource contentions
            if (!nextNode) {
                currentNode.predecessors.forEach(predId => {
                    const predNode = this.taskGraph.get(predId);
                    if (!predNode) return;

                    if (predNode.totalFloat === 0 && predNode.earliestFinish > maxFinish) {
                        maxFinish = predNode.earliestFinish;
                        nextNode = predNode;
                    }
                });
            }

            currentNode = nextNode;
        }

        this.criticalChain = chain;
        console.log(`Critical chain identified: ${chain.length} tasks`);
    }

    // Step 6: Identify Feeding Chains
    identifyFeedingChains() {
        this.feedingChains = [];

        // For each critical chain task, find non-critical predecessors
        this.criticalChain.forEach(ccTask => {
            const ccNode = this.taskGraph.get(ccTask.id);

            ccNode.predecessors.forEach(predId => {
                const predNode = this.taskGraph.get(predId);
                if (!predNode || predNode.isCriticalChain) return;

                // This is a feeding chain - walk backward to collect chain
                const feedingChain = this.walkFeedingChain(predNode);
                if (feedingChain.length > 0) {
                    this.feedingChains.push({
                        tasks: feedingChain,
                        joinsAt: ccTask.id
                    });
                }
            });
        });
    }

    // Walk backward from a task to collect feeding chain
    walkFeedingChain(startNode) {
        const chain = [];
        const visited = new Set();
        let current = startNode;

        while (current && !current.isCriticalChain && !visited.has(current.task.id)) {
            visited.add(current.task.id);
            chain.unshift(current.task);
            current.isOnFeedingChain = true;
            current.task.isOnFeedingChain = true;

            // Move to predecessor with latest finish
            if (current.predecessors.length === 0) break;

            let nextNode = null;
            let maxFinish = -1;

            current.predecessors.forEach(predId => {
                const predNode = this.taskGraph.get(predId);
                if (predNode && predNode.earliestFinish > maxFinish && !predNode.isCriticalChain) {
                    maxFinish = predNode.earliestFinish;
                    nextNode = predNode;
                }
            });

            current = nextNode;
        }

        return chain;
    }

    // Step 7: Resource Leveling - Resolve overallocations
    levelResources() {
        console.log('Resource leveling: Resolving overallocations...');

        // Find all resource overallocations
        const overallocations = this.findOverallocations();

        if (overallocations.length === 0) {
            console.log('No overallocations found');
            return;
        }

        console.log(`Found ${overallocations.length} overallocation points`);

        // Sort overallocations by day
        overallocations.sort((a, b) => a.day - b.day);

        // Resolve each overallocation
        overallocations.forEach(oa => {
            this.resolveOverallocation(oa);
        });
    }

    // Find all days where resources are overallocated
    findOverallocations() {
        const overallocations = [];

        this.resourceCalendar.forEach((calendar, resourceId) => {
            const resource = this.resources.get(resourceId);
            if (!resource) return;

            const maxCapacity = resource.getMaxDailyHours();

            calendar.forEach((hoursUsed, day) => {
                if (hoursUsed > maxCapacity) {
                    const tasksOnDay = this.findTasksUsingResourceOnDay(resourceId, day);

                    overallocations.push({
                        resourceId,
                        day,
                        capacity: maxCapacity,
                        used: hoursUsed,
                        excess: hoursUsed - maxCapacity,
                        tasks: tasksOnDay
                    });
                }
            });
        });

        return overallocations;
    }

    // Resolve a single overallocation by delaying lower-priority tasks
    resolveOverallocation(oa) {
        const resource = this.resources.get(oa.resourceId);

        // Sort tasks by priority: critical chain > float (ascending)
        const sortedTasks = oa.tasks.sort((a, b) => {
            const nodeA = this.taskGraph.get(a.id);
            const nodeB = this.taskGraph.get(b.id);

            if (nodeA.isCriticalChain && !nodeB.isCriticalChain) return -1;
            if (!nodeA.isCriticalChain && nodeB.isCriticalChain) return 1;

            return nodeA.totalFloat - nodeB.totalFloat;
        });

        // Keep highest priority task, delay others
        for (let i = 1; i < sortedTasks.length; i++) {
            const taskToDelay = sortedTasks[i];
            const node = this.taskGraph.get(taskToDelay.id);

            // Delay task by 1 day (simplified - could be more sophisticated)
            node.earliestStart += 1;
            node.earliestFinish += 1;

            // Recalculate successors
            this.recalculateSuccessors(taskToDelay.id);
        }
    }

    // Recalculate successor dates after delaying a task
    recalculateSuccessors(taskId) {
        const node = this.taskGraph.get(taskId);

        node.successors.forEach(succId => {
            const succNode = this.taskGraph.get(succId);
            const newStart = Math.max(succNode.earliestStart, node.earliestFinish);

            if (newStart > succNode.earliestStart) {
                succNode.earliestStart = newStart;
                succNode.earliestFinish = newStart + succNode.duration;

                // Cascade to successors
                this.recalculateSuccessors(succId);
            }
        });

        // Update project duration if needed
        this.projectDuration = Math.max(this.projectDuration, node.earliestFinish);
    }

    // Step 8: Apply Late-Start Scheduling
    applyLateStartScheduling() {
        console.log('Applying late-start scheduling...');

        this.taskGraph.forEach((node, taskId) => {
            if (node.isCriticalChain) {
                // Critical chain tasks: schedule at earliest possible
                node.task.scheduledStart = node.earliestStart;
                node.task.scheduledEnd = node.earliestFinish;
            } else {
                // Non-critical tasks: schedule as late as possible (minimize WIP)
                node.task.scheduledStart = node.latestStart;
                node.task.scheduledEnd = node.latestFinish;
            }

            // Update main task object with all calculated values
            node.task.earliestStart = node.earliestStart;
            node.task.earliestFinish = node.earliestFinish;
            node.task.latestStart = node.latestStart;
            node.task.latestFinish = node.latestFinish;
            node.task.totalFloat = node.totalFloat;
            node.task.freeFloat = node.freeFloat;
        });
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CCPMScheduler };
}
