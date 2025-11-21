// CCPM Buffer Manager - Automatic Buffer Sizing and Placement
// Implements Theory of Constraints buffer methodology

class BufferManager {
    constructor(tasks, resources, criticalChain, feedingChains, projectDuration) {
        this.tasks = new Map();
        this.resources = new Map();
        this.criticalChain = criticalChain || [];
        this.feedingChains = feedingChains || [];
        this.projectDuration = projectDuration || 0;
        this.buffers = [];
        this.nextBufferId = 1;

        // Load tasks and resources
        tasks.forEach(task => this.tasks.set(task.id, task));
        resources.forEach(resource => this.resources.set(resource.id, resource));
    }

    // Main method - creates all buffers
    insertAllBuffers() {
        console.log('Buffer Manager: Inserting all CCPM buffers...');

        this.buffers = [];

        // Step 1: Project Buffer (at end of critical chain)
        const projectBuffer = this.insertProjectBuffer();
        if (projectBuffer) {
            console.log(`Project Buffer: ${projectBuffer.size} days at end of project`);
        }

        // Step 2: Feeding Buffers (where feeding chains join critical chain)
        const feedingBuffers = this.insertFeedingBuffers();
        console.log(`Feeding Buffers: ${feedingBuffers.length} buffers inserted`);

        // Step 3: Resource Buffers (before constrained resources on critical chain)
        const resourceBuffers = this.insertResourceBuffers();
        console.log(`Resource Buffers: ${resourceBuffers.length} buffers inserted`);

        // Step 4: Drum Buffer (before the drum/constraint resource)
        const drumBuffer = this.insertDrumBuffer();
        if (drumBuffer) {
            console.log(`Drum Buffer: ${drumBuffer.size} days before drum resource`);
        }

        console.log(`Total buffers created: ${this.buffers.length}`);

        return this.buffers;
    }

    // Project Buffer: Protects project completion date
    // Size = 50% of aggregated safety time from critical chain
    insertProjectBuffer() {
        if (this.criticalChain.length === 0) {
            console.warn('No critical chain - cannot create project buffer');
            return null;
        }

        // Calculate total safety time removed from critical chain tasks
        const totalSafety = this.criticalChain.reduce((sum, task) => {
            return sum + (task.safetyTime || 0);
        }, 0);

        // Project buffer = 50% of aggregated safety (CCPM rule)
        const bufferSize = Math.ceil(totalSafety * 0.5);

        if (bufferSize <= 0) {
            console.warn('Project buffer size is 0 - no safety time in critical chain');
            return null;
        }

        // Buffer goes at the end of the critical chain
        const lastTask = this.criticalChain[this.criticalChain.length - 1];
        const insertionPoint = lastTask.scheduledEnd || lastTask.earliestFinish || 0;

        const projectBuffer = {
            id: this.generateBufferId('PB'),
            type: 'project',
            size: bufferSize,
            linkedTaskIds: this.criticalChain.map(t => t.id),
            insertionPoint: insertionPoint,
            consumption: 0,
            penetration: 0,
            status: 'green',
            description: 'Protects project completion date from critical chain delays'
        };

        this.buffers.push(projectBuffer);
        return projectBuffer;
    }

    // Feeding Buffers: Protect critical chain from delays in feeding chains
    // Size = 50% of aggregated safety time from the feeding chain
    insertFeedingBuffers() {
        const feedingBuffers = [];

        if (!this.feedingChains || this.feedingChains.length === 0) {
            console.log('No feeding chains identified');
            return feedingBuffers;
        }

        this.feedingChains.forEach((feedingChain, idx) => {
            const chain = feedingChain.tasks || feedingChain;
            if (!Array.isArray(chain) || chain.length === 0) return;

            // Calculate total safety time in this feeding chain
            const totalSafety = chain.reduce((sum, task) => {
                return sum + (task.safetyTime || 0);
            }, 0);

            // Feeding buffer = 50% of aggregated safety
            const bufferSize = Math.ceil(totalSafety * 0.5);

            if (bufferSize <= 0) return;

            // Buffer goes at the end of the feeding chain (where it joins CC)
            const lastTask = chain[chain.length - 1];
            const insertionPoint = lastTask.scheduledEnd || lastTask.earliestFinish || 0;

            // Find which critical chain task this feeds into
            const joinsAtTaskId = feedingChain.joinsAt || null;
            const joinsAtTask = joinsAtTaskId ? this.tasks.get(joinsAtTaskId) : null;

            const feedingBuffer = {
                id: this.generateBufferId('FB'),
                type: 'feeding',
                size: bufferSize,
                linkedTaskIds: chain.map(t => t.id),
                insertionPoint: insertionPoint,
                joinsAtTaskId: joinsAtTaskId,
                joinsAtTask: joinsAtTask ? joinsAtTask.title : 'Unknown',
                consumption: 0,
                penetration: 0,
                status: 'green',
                description: `Protects critical chain from delays in feeding chain (${chain.length} tasks)`
            };

            feedingBuffers.push(feedingBuffer);
            this.buffers.push(feedingBuffer);
        });

        return feedingBuffers;
    }

    // Resource Buffers: Alert before critical resources are needed
    // Placed before tasks using high-utilization resources on critical chain
    insertResourceBuffers() {
        const resourceBuffers = [];

        if (this.criticalChain.length === 0) return resourceBuffers;

        // Find constrained resources (high utilization or marked as drum)
        const constrainedResources = this.identifyConstrainedResources();

        if (constrainedResources.length === 0) {
            console.log('No constrained resources identified');
            return resourceBuffers;
        }

        // For each critical chain task using a constrained resource
        this.criticalChain.forEach((task, idx) => {
            if (!task.resourceAssignments || task.resourceAssignments.length === 0) return;

            // Check if task uses any constrained resources
            const usesConstrainedResource = task.resourceAssignments.some(assignment =>
                constrainedResources.some(cr => cr.id === assignment.resourceId)
            );

            if (!usesConstrainedResource) return;

            // Don't place buffer before first task
            if (idx === 0) return;

            // Resource buffer size: typically 2-3 days (alert/preparation time)
            const bufferSize = 3;

            const insertionPoint = (task.scheduledStart || task.earliestStart || 0) - bufferSize;

            const resourceBuffer = {
                id: this.generateBufferId('RB'),
                type: 'resource',
                size: bufferSize,
                linkedTaskIds: [task.id],
                insertionPoint: Math.max(0, insertionPoint),
                protectsTask: task.title,
                protectsTaskId: task.id,
                consumption: 0,
                penetration: 0,
                status: 'green',
                description: `Alert buffer before ${task.title} (uses constrained resource)`
            };

            resourceBuffers.push(resourceBuffer);
            this.buffers.push(resourceBuffer);
        });

        return resourceBuffers;
    }

    // Drum Buffer: Protects the constraint/drum resource
    // Placed before the first task using the drum resource
    insertDrumBuffer() {
        // Find the drum resource
        const drumResource = Array.from(this.resources.values()).find(r => r.isDrumResource);

        if (!drumResource) {
            console.log('No drum resource marked');
            return null;
        }

        // Find first task using the drum resource
        let firstDrumTask = null;
        let earliestStart = Infinity;

        this.tasks.forEach(task => {
            if (!task.resourceAssignments) return;

            const usesDrum = task.resourceAssignments.some(ra => ra.resourceId === drumResource.id);
            if (!usesDrum) return;

            const taskStart = task.scheduledStart || task.earliestStart || 0;
            if (taskStart < earliestStart) {
                earliestStart = taskStart;
                firstDrumTask = task;
            }
        });

        if (!firstDrumTask) {
            console.warn('Drum resource exists but no tasks use it');
            return null;
        }

        // Drum buffer size: use resource's drumBufferDays or default to 3
        const bufferSize = drumResource.drumBufferDays || 3;

        const insertionPoint = Math.max(0, earliestStart - bufferSize);

        const drumBuffer = {
            id: this.generateBufferId('DB'),
            type: 'drum',
            size: bufferSize,
            linkedTaskIds: [firstDrumTask.id],
            insertionPoint: insertionPoint,
            protectsResource: drumResource.name,
            protectsResourceId: drumResource.id,
            consumption: 0,
            penetration: 0,
            status: 'green',
            description: `Protects drum/constraint resource: ${drumResource.name}`
        };

        this.buffers.push(drumBuffer);
        return drumBuffer;
    }

    // Identify constrained resources (high utilization or marked as drum)
    identifyConstrainedResources() {
        const constrained = [];

        this.resources.forEach(resource => {
            // Always include drum resources
            if (resource.isDrumResource) {
                constrained.push(resource);
                return;
            }

            // Calculate resource utilization
            let totalHours = 0;
            this.tasks.forEach(task => {
                if (!task.resourceAssignments) return;

                task.resourceAssignments.forEach(assignment => {
                    if (assignment.resourceId === resource.id) {
                        totalHours += assignment.hoursPerDay * (task.ccpmDuration || task.durationDays);
                    }
                });
            });

            // Consider resource constrained if utilization > 80%
            const availableHours = resource.getMaxDailyHours() * 90; // 90-day window
            const utilization = (totalHours / availableHours) * 100;

            if (utilization > 80) {
                constrained.push(resource);
            }
        });

        return constrained;
    }

    // Calculate buffer consumption based on task progress
    // Returns updated buffer with new consumption/penetration/status
    calculateBufferConsumption(buffer) {
        let totalDelay = 0;
        let tasksChecked = 0;

        // Check all tasks protected by this buffer
        buffer.linkedTaskIds.forEach(taskId => {
            const task = this.tasks.get(taskId);
            if (!task) return;

            tasksChecked++;

            // If task has actual dates, calculate delay
            if (task.actualStart !== null && task.actualEnd !== null) {
                const actualDuration = task.actualEnd - task.actualStart;
                const plannedDuration = task.ccpmDuration;
                const delay = Math.max(0, actualDuration - plannedDuration);
                totalDelay += delay;
            }
            // If task is in progress, estimate delay based on progress rate
            else if (task.actualStart !== null && task.status === 'in_progress') {
                const currentDay = Date.now() / (1000 * 60 * 60 * 24); // Simplified
                const elapsed = currentDay - task.actualStart;
                const expectedElapsed = (task.progress / 100) * task.ccpmDuration;
                const currentDelay = Math.max(0, elapsed - expectedElapsed);
                totalDelay += currentDelay;
            }
        });

        // Update buffer consumption
        buffer.consumption = totalDelay;
        buffer.penetration = Math.min(100, (totalDelay / buffer.size) * 100);

        // Update status based on penetration
        if (buffer.penetration >= 66) {
            buffer.status = 'red';
        } else if (buffer.penetration >= 33) {
            buffer.status = 'yellow';
        } else {
            buffer.status = 'green';
        }

        return buffer;
    }

    // Recalculate consumption for all buffers
    updateAllBufferConsumption() {
        this.buffers.forEach(buffer => {
            this.calculateBufferConsumption(buffer);
        });

        return this.buffers;
    }

    // Get buffer status summary
    getBufferStatusSummary() {
        const summary = {
            total: this.buffers.length,
            green: 0,
            yellow: 0,
            red: 0,
            byType: {
                project: 0,
                feeding: 0,
                resource: 0,
                drum: 0
            }
        };

        this.buffers.forEach(buffer => {
            // Count by status
            if (buffer.status === 'green') summary.green++;
            else if (buffer.status === 'yellow') summary.yellow++;
            else if (buffer.status === 'red') summary.red++;

            // Count by type
            if (summary.byType.hasOwnProperty(buffer.type)) {
                summary.byType[buffer.type]++;
            }
        });

        return summary;
    }

    // Get buffers in critical status (red or yellow)
    getCriticalBuffers() {
        return this.buffers.filter(b => b.status === 'red' || b.status === 'yellow')
            .sort((a, b) => {
                // Sort red first, then by penetration
                if (a.status === 'red' && b.status !== 'red') return -1;
                if (a.status !== 'red' && b.status === 'red') return 1;
                return b.penetration - a.penetration;
            });
    }

    // Generate unique buffer ID
    generateBufferId(prefix) {
        const id = `${prefix}${this.nextBufferId}`;
        this.nextBufferId++;
        return id;
    }

    // Get all buffers
    getAllBuffers() {
        return this.buffers;
    }

    // Find buffer by ID
    getBuffer(bufferId) {
        return this.buffers.find(b => b.id === bufferId);
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BufferManager };
}
