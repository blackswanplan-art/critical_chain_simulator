// Critical Chain Simulator - Systemic Planning Edition v3.0
// Hierarchical Systemic-to-Tactical Planning System

// ===== HIERARCHICAL DATA CLASSES =====

class Objective {
    constructor(id, title, startYear, endYear) {
        this.id = id;
        this.title = title;
        this.startYear = startYear;
        this.endYear = endYear;
        this.tactics = []; // Child tactics
        this.progress = 0; // Auto-calculated from children
        this.status = 'not_started';
        this.description = '';
    }

    addTactic(tactic) {
        if (this.tactics.length >= 3) {
            throw new Error('Maximum 3 tactics per objective');
        }
        this.tactics.push(tactic);
    }

    calculateProgress() {
        if (this.tactics.length === 0) return 0;
        const sum = this.tactics.reduce((acc, t) => acc + t.calculateProgress(), 0);
        this.progress = Math.round(sum / this.tactics.length);
        return this.progress;
    }

    toString() {
        return `📋 OBJECTIVE: ${this.title} (${this.startYear}-${this.endYear})`;
    }
}

class Tactic {
    constructor(id, title, startQuarter, endQuarter, objectiveId) {
        this.id = id;
        this.title = title;
        this.startQuarter = startQuarter; // e.g., "2024-Q1"
        this.endQuarter = endQuarter;     // e.g., "2025-Q4"
        this.objectiveId = objectiveId;
        this.initiatives = []; // Child initiatives
        this.progress = 0;
        this.status = 'not_started';
        this.description = '';
    }

    addInitiative(initiative) {
        if (this.initiatives.length >= 3) {
            throw new Error('Maximum 3 initiatives per tactic');
        }
        this.initiatives.push(initiative);
    }

    calculateProgress() {
        if (this.initiatives.length === 0) return 0;
        const sum = this.initiatives.reduce((acc, i) => acc + i.calculateProgress(), 0);
        this.progress = Math.round(sum / this.initiatives.length);
        return this.progress;
    }

    toString() {
        return `🎯 TACTIC/BOULDER: ${this.title} (${this.startQuarter} to ${this.endQuarter})`;
    }
}

class Initiative {
    constructor(id, title, startQuarter, durationQuarters, tacticId) {
        this.id = id;
        this.title = title;
        this.startQuarter = startQuarter; // e.g., "2024-Q1"
        this.durationQuarters = durationQuarters; // 1-5
        this.tacticId = tacticId;
        this.tasks = []; // Child tasks
        this.progress = 0;
        this.status = 'not_started';
        this.description = '';
        this.resourceId = null;
    }

    addTask(task) {
        this.tasks.push(task);
    }

    calculateProgress() {
        if (this.tasks.length === 0) return 0;
        const sum = this.tasks.reduce((acc, t) => acc + t.progress, 0);
        this.progress = Math.round(sum / this.tasks.length);
        return this.progress;
    }

    toString() {
        return `🚀 INITIATIVE/ROCK: ${this.title} (${this.durationQuarters}Q)`;
    }
}

class SystemicTask {
    constructor(id, title, durationDays, initiativeId, resourceId = null) {
        this.id = id;
        this.title = title;
        this.durationDays = durationDays; // 1-90 days (nominal duration with safety)
        this.initiativeId = initiativeId;

        // CCPM Multi-Resource Support
        this.resourceAssignments = []; // Array of {resourceId, hoursPerDay, role}

        // Backward compatibility: convert old single resourceId to array
        if (resourceId) {
            this.resourceAssignments.push({
                resourceId: resourceId,
                hoursPerDay: 8,
                role: 'primary'
            });
        }

        // CCPM Duration Properties
        this.nominalDuration = durationDays; // Original estimate with safety
        this.ccpmDuration = Math.max(1, Math.ceil(durationDays / 2)); // 50% rule - aggressive estimate
        this.safetyTime = durationDays - this.ccpmDuration; // Removed safety (goes into buffers)
        this.estimatedHours = durationDays * 8; // Total effort estimate

        // Task Status
        this.progress = 0; // 0-100%
        this.status = 'not_started'; // not_started, in_progress, completed
        this.description = '';

        // Dependencies
        this.predecessors = []; // Task IDs that must complete before this starts
        this.successors = []; // Task IDs that depend on this (calculated)

        // CCPM Scheduling Properties (calculated by scheduler)
        this.earliestStart = 0;
        this.latestStart = Infinity;
        this.earliestFinish = 0;
        this.latestFinish = Infinity;
        this.totalFloat = Infinity; // Slack time
        this.freeFloat = 0;
        this.isCriticalChain = false;
        this.scheduledStart = null; // Actual scheduled start (late-start)
        this.scheduledEnd = null; // Actual scheduled end

        // Actual dates (for tracking)
        this.actualStart = null;
        this.actualEnd = null;
    }

    // Add a resource to this task
    addResource(resourceId, hoursPerDay = 8, role = 'primary') {
        // Check if resource already assigned
        const existing = this.resourceAssignments.find(ra => ra.resourceId === resourceId);
        if (!existing) {
            this.resourceAssignments.push({resourceId, hoursPerDay, role});
        }
    }

    // Remove a resource from this task
    removeResource(resourceId) {
        this.resourceAssignments = this.resourceAssignments.filter(
            ra => ra.resourceId !== resourceId
        );
    }

    // Get all resource IDs assigned to this task
    getResourceIds() {
        return this.resourceAssignments.map(ra => ra.resourceId);
    }

    // Check if a specific resource is assigned
    hasResource(resourceId) {
        return this.resourceAssignments.some(ra => ra.resourceId === resourceId);
    }

    // Get total resource hours needed
    getTotalResourceHours() {
        return this.resourceAssignments.reduce((sum, ra) =>
            sum + (ra.hoursPerDay * this.ccpmDuration), 0);
    }

    // Backward compatibility: getter for old code using task.resourceId
    get resourceId() {
        return this.resourceAssignments.length > 0
            ? this.resourceAssignments[0].resourceId
            : null;
    }

    // Backward compatibility: setter for old code
    set resourceId(value) {
        if (value && !this.hasResource(value)) {
            this.addResource(value, 8, 'primary');
        }
    }

    toString() {
        const resources = this.resourceAssignments.length > 0
            ? ` [${this.resourceAssignments.length} resources]`
            : '';
        return `✓ TASK/TO-DO: ${this.title} (${this.durationDays}d)${resources}`;
    }
}

class Resource {
    constructor(id, name, type = 'person') {
        this.id = id;
        this.name = name;
        this.type = type; // 'person', 'equipment', 'space', 'financial', 'supplier', 'decision_maker', 'skill_pool'

        // Capacity settings
        this.capacity = 1; // Number of units (e.g., 3 FTEs)
        this.availabilityPercent = 80; // 80% availability
        this.maxCapacityPerDay = 8; // hours per day (for people)
        this.loadLimitPercent = 75; // Load limit (70-80% of theoretical capacity)

        // Resource characteristics
        this.isDrumResource = false; // Is this the throughput constraint?
        this.isSharedAcrossProjects = false;
        this.cost = 0; // Cost per unit/day

        // For specific resource types
        this.role = ''; // For people: Owner, Operator, Designer, etc.
        this.location = ''; // For space resources
        this.budgetLimit = 0; // For financial resources

        // Metadata
        this.description = '';
        this.notes = '';
    }

    getEffectiveCapacity() {
        return this.capacity * (this.availabilityPercent / 100) * (this.loadLimitPercent / 100);
    }

    getMaxDailyHours() {
        if (this.type === 'person' || this.type === 'skill_pool') {
            return this.maxCapacityPerDay * this.capacity * (this.availabilityPercent / 100);
        }
        return this.maxCapacityPerDay;
    }

    toString() {
        return `${this.getTypeIcon()} ${this.name} (${this.capacity} @ ${this.availabilityPercent}%)`;
    }

    getTypeIcon() {
        const icons = {
            'person': '👤',
            'equipment': '⚙️',
            'space': '📍',
            'financial': '💰',
            'supplier': '🏭',
            'decision_maker': '👔',
            'skill_pool': '👥'
        };
        return icons[this.type] || '📦';
    }
}

// Buffer classes for CCPM
class Buffer {
    constructor(id, type, size, taskId = null) {
        this.id = id;
        this.type = type; // 'project', 'feeding', 'resource'
        this.size = size; // Duration in days
        this.consumption = 0; // How much has been used (0-100%)
        this.taskId = taskId; // Associated task if applicable
        this.status = 'green'; // green, yellow, red
        this.createdDate = new Date();
    }

    updateConsumption(consumed) {
        this.consumption = Math.min(100, Math.max(0, consumed));
        this.updateStatus();
    }

    updateStatus() {
        // Green: 0-33%, Yellow: 33-66%, Red: 66-100%
        if (this.consumption >= 66) {
            this.status = 'red';
        } else if (this.consumption >= 33) {
            this.status = 'yellow';
        } else {
            this.status = 'green';
        }
    }

    getColorCode() {
        return this.status === 'red' ? '#f44336' :
               this.status === 'yellow' ? '#ff9800' : '#4caf50';
    }
}

// ===== SYSTEMIC PROJECT STATE =====

class SystemicProjectState {
    constructor() {
        this.projectName = 'Systemic Plan';
        this.objectives = [];
        this.resources = [];
        this.buffers = []; // Project, feeding, and resource buffers
        this.currentDate = new Date();
        this.createdDate = new Date().toISOString();
        this.nextObjectiveId = 1;
        this.nextTacticId = 1;
        this.nextInitiativeId = 1;
        this.nextTaskId = 1;
        this.nextResourceId = 1;
        this.nextBufferId = 1;

        // Resource management
        this.resourceLoads = new Map(); // Track resource usage over time
        this.criticalChain = []; // Tasks on the resource-constrained critical path
    }

    // Objective operations
    addObjective(title, startYear, endYear) {
        if (this.objectives.length >= 3) {
            throw new Error('Maximum 3 objectives allowed');
        }
        const obj = new Objective(this.nextObjectiveId++, title, startYear, endYear);
        this.objectives.push(obj);
        return obj;
    }

    getObjective(id) {
        return this.objectives.find(o => o.id === id);
    }

    deleteObjective(id) {
        this.objectives = this.objectives.filter(o => o.id !== id);
    }

    // Tactic operations
    addTactic(title, startQuarter, endQuarter, objectiveId) {
        const objective = this.getObjective(objectiveId);
        if (!objective) throw new Error('Objective not found');

        const tactic = new Tactic(this.nextTacticId++, title, startQuarter, endQuarter, objectiveId);
        objective.addTactic(tactic);
        return tactic;
    }

    getTactic(objectiveId, tacticId) {
        const objective = this.getObjective(objectiveId);
        if (!objective) return null;
        return objective.tactics.find(t => t.id === tacticId);
    }

    getAllTactics() {
        return this.objectives.flatMap(o => o.tactics);
    }

    deleteTactic(objectiveId, tacticId) {
        const objective = this.getObjective(objectiveId);
        if (objective) {
            objective.tactics = objective.tactics.filter(t => t.id !== tacticId);
        }
    }

    // Initiative operations
    addInitiative(title, startQuarter, durationQuarters, objectiveId, tacticId) {
        const objective = this.getObjective(objectiveId);
        if (!objective) throw new Error('Objective not found');

        const tactic = objective.tactics.find(t => t.id === tacticId);
        if (!tactic) throw new Error('Tactic not found');

        const initiative = new Initiative(this.nextInitiativeId++, title, startQuarter, durationQuarters, tacticId);
        tactic.addInitiative(initiative);
        return initiative;
    }

    getInitiative(objectiveId, tacticId, initiativeId) {
        const tactic = this.getTactic(objectiveId, tacticId);
        if (!tactic) return null;
        return tactic.initiatives.find(i => i.id === initiativeId);
    }

    getAllInitiatives() {
        return this.objectives.flatMap(o =>
            o.tactics.flatMap(t => t.initiatives)
        );
    }

    deleteInitiative(objectiveId, tacticId, initiativeId) {
        const tactic = this.getTactic(objectiveId, tacticId);
        if (tactic) {
            tactic.initiatives = tactic.initiatives.filter(i => i.id !== initiativeId);
        }
    }

    // Task operations
    addTask(title, durationDays, objectiveId, tacticId, initiativeId, resourceId = null) {
        const initiative = this.getInitiative(objectiveId, tacticId, initiativeId);
        if (!initiative) throw new Error('Initiative not found');

        if (durationDays < 1 || durationDays > 90) {
            throw new Error('Task duration must be between 1 and 90 days');
        }

        const task = new SystemicTask(this.nextTaskId++, title, durationDays, initiativeId, resourceId);
        initiative.addTask(task);
        return task;
    }

    getTask(objectiveId, tacticId, initiativeId, taskId) {
        const initiative = this.getInitiative(objectiveId, tacticId, initiativeId);
        if (!initiative) return null;
        return initiative.tasks.find(t => t.id === taskId);
    }

    getAllTasks() {
        return this.objectives.flatMap(o =>
            o.tactics.flatMap(t =>
                t.initiatives.flatMap(i => i.tasks)
            )
        );
    }

    deleteTask(objectiveId, tacticId, initiativeId, taskId) {
        const initiative = this.getInitiative(objectiveId, tacticId, initiativeId);
        if (initiative) {
            initiative.tasks = initiative.tasks.filter(t => t.id !== taskId);
        }
    }

    // Resource operations
    addResource(name, type = 'person') {
        const resource = new Resource(this.nextResourceId++, name, type);
        this.resources.push(resource);
        return resource;
    }

    deleteResource(id) {
        this.resources = this.resources.filter(r => r.id !== id);
    }

    getResource(id) {
        return this.resources.find(r => r.id === id);
    }

    // Create common resource templates
    loadCommonResources() {
        const templates = [
            { name: 'Owner / CEO', type: 'decision_maker', role: 'Owner', capacity: 1, availability: 60, loadLimit: 70, isDrum: true },
            { name: 'Investment Committee', type: 'decision_maker', role: 'Committee', capacity: 1, availability: 40, loadLimit: 60 },
            { name: 'Fractional CFO', type: 'person', role: 'CFO', capacity: 1, availability: 50, loadLimit: 75, isShared: true },
            { name: 'Exit Planner', type: 'person', role: 'Planner', capacity: 1, availability: 80, loadLimit: 75, isShared: true },
            { name: 'Designer / Engineer', type: 'skill_pool', role: 'Designer', capacity: 2, availability: 80, loadLimit: 75 },
            { name: 'SME (Subject Matter Expert)', type: 'skill_pool', role: 'SME', capacity: 1, availability: 70, loadLimit: 70 },
            { name: 'Operator', type: 'skill_pool', role: 'Operator', capacity: 3, availability: 80, loadLimit: 80 },
            { name: 'Conference Room A', type: 'space', location: 'Main Building', capacity: 1, maxPerDay: 10 },
            { name: 'Workshop Bay 1', type: 'space', location: 'Workshop', capacity: 1, maxPerDay: 16 },
            { name: 'Monthly OpEx Budget', type: 'financial', budgetLimit: 50000, capacity: 1 }
        ];

        templates.forEach(t => {
            const resource = this.addResource(t.name, t.type);
            resource.role = t.role || '';
            resource.capacity = t.capacity;
            resource.availabilityPercent = t.availability;
            resource.loadLimitPercent = t.loadLimit;
            resource.isDrumResource = t.isDrum || false;
            resource.isSharedAcrossProjects = t.isShared || false;
            resource.location = t.location || '';
            resource.budgetLimit = t.budgetLimit || 0;
            resource.maxCapacityPerDay = t.maxPerDay || 8;
        });
    }

    // Buffer operations
    addBuffer(type, size, taskId = null) {
        const buffer = new Buffer(this.nextBufferId++, type, size, taskId);
        this.buffers.push(buffer);
        return buffer;
    }

    getBuffer(id) {
        return this.buffers.find(b => b.id === id);
    }

    deleteBuffer(id) {
        this.buffers = this.buffers.filter(b => b.id !== id);
    }

    // Calculate resource load across all tasks (multi-resource aware)
    calculateResourceLoad() {
        this.resourceLoads.clear();

        const allTasks = this.getAllTasks();
        allTasks.forEach(task => {
            // Handle multi-resource assignments
            if (task.resourceAssignments && task.resourceAssignments.length > 0) {
                task.resourceAssignments.forEach(assignment => {
                    const resourceId = assignment.resourceId;

                    if (!this.resourceLoads.has(resourceId)) {
                        this.resourceLoads.set(resourceId, {
                            totalDays: 0,
                            totalHours: 0,
                            tasks: [],
                            utilizationPercent: 0
                        });
                    }

                    const load = this.resourceLoads.get(resourceId);

                    // Calculate hours based on assignment
                    const taskHours = assignment.hoursPerDay * task.ccpmDuration;
                    load.totalHours += taskHours;
                    load.totalDays += (taskHours / 8); // Convert to day-equivalents

                    // Only add task once even if it has multiple resources
                    if (!load.tasks.some(t => t.id === task.id)) {
                        load.tasks.push(task);
                    }
                });
            }
            // Backward compatibility: handle old tasks with single resourceId
            else if (task.resourceId) {
                const resourceId = task.resourceId;

                if (!this.resourceLoads.has(resourceId)) {
                    this.resourceLoads.set(resourceId, {
                        totalDays: 0,
                        totalHours: 0,
                        tasks: [],
                        utilizationPercent: 0
                    });
                }

                const load = this.resourceLoads.get(resourceId);
                load.totalDays += task.durationDays;
                load.totalHours += task.durationDays * 8;
                load.tasks.push(task);
            }
        });

        // Calculate utilization percentage
        this.resourceLoads.forEach((load, resourceId) => {
            const resource = this.getResource(resourceId);
            if (resource) {
                const maxAvailableHours = resource.getMaxDailyHours() * 90; // 90-day window
                load.utilizationPercent = (load.totalHours / maxAvailableHours) * 100;
            }
        });

        return this.resourceLoads;
    }

    // Identify resource-constrained critical chain
    identifyCriticalChain() {
        const allTasks = this.getAllTasks();

        // Find tasks with dependencies and resource constraints
        const taskGraph = new Map();
        allTasks.forEach(task => {
            taskGraph.set(task.id, {
                task: task,
                duration: task.durationDays,
                resource: task.resourceId,
                successors: [],
                earliestStart: 0,
                latestStart: Infinity,
                slack: Infinity
            });
        });

        // Build dependency graph
        allTasks.forEach(task => {
            if (task.predecessors && task.predecessors.length > 0) {
                task.predecessors.forEach(predId => {
                    const predNode = taskGraph.get(predId);
                    if (predNode) {
                        predNode.successors.push(task.id);
                    }
                });
            }
        });

        // Forward pass - calculate earliest start
        const visited = new Set();
        const calculateEarliestStart = (taskId) => {
            if (visited.has(taskId)) return;
            visited.add(taskId);

            const node = taskGraph.get(taskId);
            const task = node.task;

            if (task.predecessors && task.predecessors.length > 0) {
                task.predecessors.forEach(predId => {
                    calculateEarliestStart(predId);
                    const predNode = taskGraph.get(predId);
                    if (predNode) {
                        node.earliestStart = Math.max(node.earliestStart, predNode.earliestStart + predNode.duration);
                    }
                });
            }

            node.successors.forEach(succId => calculateEarliestStart(succId));
        };

        taskGraph.forEach((node, taskId) => calculateEarliestStart(taskId));

        // Find critical path (tasks with zero slack)
        this.criticalChain = Array.from(taskGraph.values())
            .filter(node => node.slack === 0 || node.task.resourceId)
            .map(node => node.task)
            .sort((a, b) => {
                const nodeA = taskGraph.get(a.id);
                const nodeB = taskGraph.get(b.id);
                return nodeA.earliestStart - nodeB.earliestStart;
            });

        return this.criticalChain;
    }

    // Get drum resources (throughput constraints)
    getDrumResources() {
        return this.resources.filter(r => r.isDrumResource);
    }

    // Get shared resources
    getSharedResources() {
        return this.resources.filter(r => r.isSharedAcrossProjects);
    }

    // Progress calculation
    calculateAllProgress() {
        this.objectives.forEach(obj => obj.calculateProgress());
    }

    // Serialization
    toJSON() {
        return {
            projectName: this.projectName,
            currentDate: this.currentDate,
            objectives: this.objectives,
            resources: this.resources,
            buffers: this.buffers,
            criticalChain: this.criticalChain.map(t => t.id),
            nextObjectiveId: this.nextObjectiveId,
            nextTacticId: this.nextTacticId,
            nextInitiativeId: this.nextInitiativeId,
            nextTaskId: this.nextTaskId,
            nextResourceId: this.nextResourceId,
            nextBufferId: this.nextBufferId,
            createdDate: this.createdDate,
            modifiedDate: new Date().toISOString()
        };
    }

    fromJSON(data) {
        this.projectName = data.projectName;
        this.currentDate = new Date(data.currentDate);
        this.nextObjectiveId = data.nextObjectiveId || 1;
        this.nextTacticId = data.nextTacticId || 1;
        this.nextInitiativeId = data.nextInitiativeId || 1;
        this.nextTaskId = data.nextTaskId || 1;
        this.nextResourceId = data.nextResourceId || 1;
        this.nextBufferId = data.nextBufferId || 1;
        this.createdDate = data.createdDate;

        // Reconstruct resources with enhanced properties
        this.resources = (data.resources || []).map(r => {
            const resource = new Resource(r.id, r.name, r.type || 'person');
            resource.capacity = r.capacity || 1;
            resource.availabilityPercent = r.availabilityPercent || 80;
            resource.maxCapacityPerDay = r.maxCapacityPerDay || 8;
            resource.loadLimitPercent = r.loadLimitPercent || 75;
            resource.isDrumResource = r.isDrumResource || false;
            resource.isSharedAcrossProjects = r.isSharedAcrossProjects || false;
            resource.cost = r.cost || 0;
            resource.role = r.role || '';
            resource.location = r.location || '';
            resource.budgetLimit = r.budgetLimit || 0;
            resource.description = r.description || '';
            resource.notes = r.notes || '';
            return resource;
        });

        // Reconstruct buffers
        this.buffers = (data.buffers || []).map(b => {
            const buffer = new Buffer(b.id, b.type, b.size, b.taskId);
            buffer.consumption = b.consumption || 0;
            buffer.status = b.status || 'green';
            buffer.createdDate = new Date(b.createdDate);
            return buffer;
        });

        // Reconstruct hierarchy
        this.objectives = (data.objectives || []).map(objData => {
            const objective = new Objective(objData.id, objData.title, objData.startYear, objData.endYear);
            objective.description = objData.description || '';
            objective.status = objData.status || 'not_started';

            objective.tactics = (objData.tactics || []).map(tacData => {
                const tactic = new Tactic(tacData.id, tacData.title, tacData.startQuarter, tacData.endQuarter, tacData.objectiveId);
                tactic.description = tacData.description || '';
                tactic.status = tacData.status || 'not_started';

                tactic.initiatives = (tacData.initiatives || []).map(initData => {
                    const initiative = new Initiative(initData.id, initData.title, initData.startQuarter, initData.durationQuarters, initData.tacticId);
                    initiative.description = initData.description || '';
                    initiative.status = initData.status || 'not_started';
                    initiative.resourceId = initData.resourceId;

                    initiative.tasks = (initData.tasks || []).map(taskData => {
                        const task = new SystemicTask(taskData.id, taskData.title, taskData.durationDays, taskData.initiativeId, taskData.resourceId);
                        task.progress = taskData.progress || 0;
                        task.status = taskData.status || 'not_started';
                        task.description = taskData.description || '';
                        task.predecessors = taskData.predecessors || [];
                        task.actualStart = taskData.actualStart;
                        task.actualEnd = taskData.actualEnd;
                        return task;
                    });

                    return initiative;
                });

                return tactic;
            });

            return objective;
        });

        this.calculateAllProgress();
    }
}

// ===== GLOBAL STATE =====

let systemicState = new SystemicProjectState();
let canvas, ctx;
let scale = 1;
let viewMode = 'all'; // all, objectives, tactics, initiatives, tasks
let currentView = 'timeline'; // timeline, resourceLoad, buffers, calendar
let selectedItem = null;
let editingItem = null;
let autoSaveInterval = null;

// ===== INITIALIZATION =====

window.addEventListener('load', () => {
    canvas = document.getElementById('systemicCanvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        canvas.addEventListener('click', handleCanvasClick);
    }

    loadFromLocalStorage();
    startAutoSave();
    renderHierarchy();
    renderCanvas();
    updateStats();
});

function resizeCanvas() {
    if (!canvas) return;
    const wrapper = canvas.parentElement;
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    renderCanvas();
}

// ===== PERSISTENCE =====

function saveToLocalStorage() {
    try {
        const data = systemicState.toJSON();
        localStorage.setItem('systemic_plan_v3', JSON.stringify(data));
        console.log('Systemic plan auto-saved');
    } catch (e) {
        console.error('Failed to save:', e);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('systemic_plan_v3');
        if (saved) {
            const data = JSON.parse(saved);
            systemicState.fromJSON(data);
            console.log('Systemic plan loaded');
        }
    } catch (e) {
        console.error('Failed to load:', e);
    }
}

function startAutoSave() {
    autoSaveInterval = setInterval(() => {
        saveToLocalStorage();
    }, 10000);
}

function exportToJSON() {
    const data = systemicState.toJSON();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${systemicState.projectName.replace(/\s+/g, '_')}_systemic_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                systemicState.fromJSON(data);
                renderHierarchy();
                renderCanvas();
                updateStats();
                saveToLocalStorage();
                alert('Systemic plan imported successfully!');
            } catch (err) {
                alert('Failed to import: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ===== UI RENDERING =====

function renderHierarchy() {
    const container = document.getElementById('hierarchyTree');
    if (!container) return;

    container.innerHTML = '';

    if (systemicState.objectives.length === 0) {
        container.innerHTML = '<div class="empty-state">No objectives yet. Add your first systemic objective to begin.</div>';
        return;
    }

    systemicState.objectives.forEach(objective => {
        const objElement = createObjectiveElement(objective);
        container.appendChild(objElement);
    });
}

function createObjectiveElement(objective) {
    const div = document.createElement('div');
    div.className = 'hierarchy-item objective-item';
    div.innerHTML = `
        <div class="item-header">
            <span class="item-icon">📋</span>
            <span class="item-title" onclick="editItem('objective', ${objective.id})">${objective.title}</span>
            <span class="item-timeline">${objective.startYear}-${objective.endYear}</span>
            <span class="item-progress">${objective.progress}%</span>
            <button onclick="deleteObjective(${objective.id})" class="btn-remove">×</button>
        </div>
        <div class="item-children" id="objective-${objective.id}-children"></div>
        <button onclick="showAddTacticForm(${objective.id})" class="btn-add-child">+ Add Tactic/Boulder</button>
    `;

    const childrenContainer = div.querySelector(`#objective-${objective.id}-children`);
    objective.tactics.forEach(tactic => {
        childrenContainer.appendChild(createTacticElement(tactic, objective.id));
    });

    return div;
}

function createTacticElement(tactic, objectiveId) {
    const div = document.createElement('div');
    div.className = 'hierarchy-item tactic-item';
    div.innerHTML = `
        <div class="item-header">
            <span class="item-icon">🎯</span>
            <span class="item-title" onclick="editItem('tactic', ${objectiveId}, ${tactic.id})">${tactic.title}</span>
            <span class="item-timeline">${tactic.startQuarter} to ${tactic.endQuarter}</span>
            <span class="item-progress">${tactic.progress}%</span>
            <button onclick="deleteTactic(${objectiveId}, ${tactic.id})" class="btn-remove">×</button>
        </div>
        <div class="item-children" id="tactic-${tactic.id}-children"></div>
        <button onclick="showAddInitiativeForm(${objectiveId}, ${tactic.id})" class="btn-add-child">+ Add Initiative/Rock</button>
    `;

    const childrenContainer = div.querySelector(`#tactic-${tactic.id}-children`);
    tactic.initiatives.forEach(initiative => {
        childrenContainer.appendChild(createInitiativeElement(initiative, objectiveId, tactic.id));
    });

    return div;
}

function createInitiativeElement(initiative, objectiveId, tacticId) {
    const div = document.createElement('div');
    div.className = 'hierarchy-item initiative-item';
    div.innerHTML = `
        <div class="item-header">
            <span class="item-icon">🚀</span>
            <span class="item-title" onclick="editItem('initiative', ${objectiveId}, ${tacticId}, ${initiative.id})">${initiative.title}</span>
            <span class="item-timeline">${initiative.durationQuarters}Q starting ${initiative.startQuarter}</span>
            <span class="item-progress">${initiative.progress}%</span>
            <button onclick="deleteInitiative(${objectiveId}, ${tacticId}, ${initiative.id})" class="btn-remove">×</button>
        </div>
        <div class="item-children" id="initiative-${initiative.id}-children"></div>
        <button onclick="showAddTaskForm(${objectiveId}, ${tacticId}, ${initiative.id})" class="btn-add-child">+ Add Task/To-Do</button>
    `;

    const childrenContainer = div.querySelector(`#initiative-${initiative.id}-children`);
    initiative.tasks.forEach(task => {
        childrenContainer.appendChild(createTaskElement(task, objectiveId, tacticId, initiative.id));
    });

    return div;
}

function createTaskElement(task, objectiveId, tacticId, initiativeId) {
    const div = document.createElement('div');
    div.className = 'hierarchy-item task-item';

    // Build resource badges display
    let resourceBadges = '';
    if (task.resourceAssignments && task.resourceAssignments.length > 0) {
        task.resourceAssignments.forEach(assignment => {
            const resource = systemicState.getResource(assignment.resourceId);
            if (resource) {
                resourceBadges += `<span style="background: #e0e0e0; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 4px;">
                    ${resource.getTypeIcon()} ${resource.name} (${assignment.hoursPerDay}h/d)
                </span>`;
            }
        });
    }

    // Critical chain badge
    let criticalChainBadge = '';
    if (task.isCriticalChain) {
        criticalChainBadge = `<span style="background: #f44336; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; margin-right: 4px;">
            ⚠️ CRITICAL CHAIN
        </span>`;
    }

    // Scheduled dates display
    let scheduledInfo = '';
    if (task.scheduledStart !== null && task.scheduledStart !== undefined) {
        const floatInfo = task.totalFloat !== undefined && task.totalFloat !== Infinity ?
            ` | Float: ${task.totalFloat.toFixed(1)}d` : '';
        scheduledInfo = `<div style="margin-top: 4px; font-size: 10px; color: #666;">
            Scheduled: Day ${task.scheduledStart.toFixed(1)} - ${task.scheduledEnd.toFixed(1)}${floatInfo}
        </div>`;
    }

    const resourceDisplay = (resourceBadges || criticalChainBadge) ?
        `<div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">${criticalChainBadge}${resourceBadges}</div>` : '';

    div.innerHTML = `
        <div class="item-header">
            <span class="item-icon">✓</span>
            <span class="item-title" onclick="editItem('task', ${objectiveId}, ${tacticId}, ${initiativeId}, ${task.id})">${task.title}</span>
            <span class="item-timeline">${task.durationDays} days (CCPM: ${task.ccpmDuration}d)</span>
            <div class="task-progress-inline">
                <input type="range" min="0" max="100" value="${task.progress}"
                       onchange="updateTaskProgress(${objectiveId}, ${tacticId}, ${initiativeId}, ${task.id}, this.value)"
                       onclick="event.stopPropagation()">
                <span>${task.progress}%</span>
            </div>
            <button onclick="deleteTask(${objectiveId}, ${tacticId}, ${initiativeId}, ${task.id})" class="btn-remove">×</button>
        </div>
        ${resourceDisplay}
        ${scheduledInfo}
    `;

    return div;
}

// ===== CRUD OPERATIONS =====

// Add operations (showing forms)
function showAddObjectiveForm() {
    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    if (systemicState.objectives.length >= 3) {
        alert('Maximum 3 objectives allowed');
        return;
    }

    content.innerHTML = `
        <h2>Add Objective (Strategic Goal)</h2>
        <p class="form-subtitle">3-5 year timeline</p>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="objTitle" placeholder="Enter objective title">
        </div>
        <div class="form-group">
            <label>Start Year:</label>
            <input type="number" id="objStartYear" value="${new Date().getFullYear()}" min="2020" max="2050">
        </div>
        <div class="form-group">
            <label>End Year:</label>
            <input type="number" id="objEndYear" value="${new Date().getFullYear() + 3}" min="2020" max="2050">
        </div>
        <div class="form-actions">
            <button onclick="saveObjective()" class="btn btn-primary">Save</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';
}

function saveObjective() {
    const title = document.getElementById('objTitle').value.trim();
    const startYear = parseInt(document.getElementById('objStartYear').value);
    const endYear = parseInt(document.getElementById('objEndYear').value);

    if (!title) {
        alert('Please enter a title');
        return;
    }

    if (endYear <= startYear) {
        alert('End year must be after start year');
        return;
    }

    if (endYear - startYear < 3 || endYear - startYear > 5) {
        alert('Objectives should be 3-5 years');
        return;
    }

    try {
        systemicState.addObjective(title, startYear, endYear);
        closeModal();
        renderHierarchy();
        renderCanvas();
        updateStats();
        saveToLocalStorage();
    } catch (err) {
        alert(err.message);
    }
}

// Continue implementing remaining CRUD operations...
// (This is part 1 of the file - continuing in next block)

// Make functions globally accessible
window.showAddObjectiveForm = showAddObjectiveForm;
window.saveObjective = saveObjective;
window.exportToJSON = exportToJSON;
window.importFromJSON = importFromJSON;

// ===== TACTIC CRUD =====

function showAddTacticForm(objectiveId) {
    const objective = systemicState.getObjective(objectiveId);
    if (!objective) return;

    if (objective.tactics.length >= 3) {
        alert('Maximum 3 tactics per objective');
        return;
    }

    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    content.innerHTML = `
        <h2>Add Tactic / Boulder</h2>
        <p class="form-subtitle">1-2 year timeline for Objective: ${objective.title}</p>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="tacticTitle" placeholder="Enter tactic title">
        </div>
        <div class="form-group">
            <label>Start Quarter:</label>
            <input type="text" id="tacticStartQ" placeholder="e.g., 2024-Q1" value="${objective.startYear}-Q1">
        </div>
        <div class="form-group">
            <label>End Quarter:</label>
            <input type="text" id="tacticEndQ" placeholder="e.g., 2025-Q4" value="${objective.startYear + 1}-Q4">
        </div>
        <div class="form-actions">
            <button onclick="saveTactic(${objectiveId})" class="btn btn-primary">Save</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';
}

function saveTactic(objectiveId) {
    const title = document.getElementById('tacticTitle').value.trim();
    const startQ = document.getElementById('tacticStartQ').value.trim();
    const endQ = document.getElementById('tacticEndQ').value.trim();

    if (!title) {
        alert('Please enter a title');
        return;
    }

    try {
        systemicState.addTactic(title, startQ, endQ, objectiveId);
        closeModal();
        renderHierarchy();
        renderCanvas();
        updateStats();
        saveToLocalStorage();
    } catch (err) {
        alert(err.message);
    }
}

// ===== INITIATIVE CRUD =====

function showAddInitiativeForm(objectiveId, tacticId) {
    const tactic = systemicState.getTactic(objectiveId, tacticId);
    if (!tactic) return;

    if (tactic.initiatives.length >= 3) {
        alert('Maximum 3 initiatives per tactic');
        return;
    }

    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    content.innerHTML = `
        <h2>Add Initiative / Action Plan / Rock</h2>
        <p class="form-subtitle">1-5 quarter project for Tactic: ${tactic.title}</p>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="initTitle" placeholder="Enter initiative title">
        </div>
        <div class="form-group">
            <label>Start Quarter:</label>
            <input type="text" id="initStartQ" placeholder="e.g., 2024-Q1" value="${tactic.startQuarter}">
        </div>
        <div class="form-group">
            <label>Duration (Quarters):</label>
            <input type="number" id="initDuration" min="1" max="5" value="2">
        </div>
        <div class="form-actions">
            <button onclick="saveInitiative(${objectiveId}, ${tacticId})" class="btn btn-primary">Save</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';
}

function saveInitiative(objectiveId, tacticId) {
    const title = document.getElementById('initTitle').value.trim();
    const startQ = document.getElementById('initStartQ').value.trim();
    const duration = parseInt(document.getElementById('initDuration').value);

    if (!title) {
        alert('Please enter a title');
        return;
    }

    if (duration < 1 || duration > 5) {
        alert('Duration must be 1-5 quarters');
        return;
    }

    try {
        systemicState.addInitiative(title, startQ, duration, objectiveId, tacticId);
        closeModal();
        renderHierarchy();
        renderCanvas();
        updateStats();
        saveToLocalStorage();
    } catch (err) {
        alert(err.message);
    }
}

// ===== TASK CRUD =====

function showAddTaskForm(objectiveId, tacticId, initiativeId) {
    const initiative = systemicState.getInitiative(objectiveId, tacticId, initiativeId);
    if (!initiative) return;

    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    // Build multi-resource selection with checkboxes
    let resourceCheckboxes = '';
    if (systemicState.resources.length === 0) {
        resourceCheckboxes = '<p style="color: #999; font-size: 12px;">No resources available. Add resources first.</p>';
    } else {
        systemicState.resources.forEach(r => {
            resourceCheckboxes += `
                <div style="margin-bottom: 8px; padding: 6px; background: #f9f9f9; border-radius: 4px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" class="resource-checkbox" value="${r.id}" data-name="${r.name}">
                        <span>${r.getTypeIcon()} ${r.name}</span>
                        <input type="number" class="resource-hours" data-resource="${r.id}"
                               placeholder="hrs/day" min="1" max="24" value="8"
                               style="width: 70px; margin-left: auto; padding: 4px; font-size: 12px;"
                               disabled>
                    </label>
                </div>
            `;
        });
    }

    content.innerHTML = `
        <h2>Add Task / To-Do</h2>
        <p class="form-subtitle">1-90 day action item for Initiative: ${initiative.title}</p>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="taskTitle" placeholder="Enter task title">
        </div>
        <div class="form-group">
            <label>Duration (Days):</label>
            <input type="number" id="taskDuration" min="1" max="90" value="5">
        </div>
        <div class="form-group">
            <label>Resources (Select Multiple):</label>
            <div id="taskResourcesContainer" style="max-height: 250px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
                ${resourceCheckboxes}
            </div>
            <p style="font-size: 11px; color: #666; margin-top: 5px;">
                💡 Check resources and set hours/day for each. Tasks can use multiple resources simultaneously.
            </p>
        </div>
        <div class="form-actions">
            <button onclick="saveTask(${objectiveId}, ${tacticId}, ${initiativeId})" class="btn btn-primary">Save</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';

    // Add event listeners to enable/disable hours input when checkbox is toggled
    document.querySelectorAll('.resource-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const resourceId = e.target.value;
            const hoursInput = document.querySelector(`.resource-hours[data-resource="${resourceId}"]`);
            if (hoursInput) {
                hoursInput.disabled = !e.target.checked;
                if (e.target.checked && !hoursInput.value) {
                    hoursInput.value = 8; // Default to 8 hours/day
                }
            }
        });
    });
}

function saveTask(objectiveId, tacticId, initiativeId) {
    const title = document.getElementById('taskTitle').value.trim();
    const duration = parseInt(document.getElementById('taskDuration').value);

    if (!title) {
        alert('Please enter a title');
        return;
    }

    // Collect selected resources and their hours
    const resourceAssignments = [];
    document.querySelectorAll('.resource-checkbox:checked').forEach(checkbox => {
        const resourceId = parseInt(checkbox.value);
        const hoursInput = document.querySelector(`.resource-hours[data-resource="${resourceId}"]`);
        const hoursPerDay = hoursInput ? parseInt(hoursInput.value) || 8 : 8;

        resourceAssignments.push({
            resourceId: resourceId,
            hoursPerDay: hoursPerDay,
            role: 'primary'
        });
    });

    try {
        // Create task (backward compatible - pass null for old resourceId param)
        const task = systemicState.addTask(title, duration, objectiveId, tacticId, initiativeId, null);

        // Add resource assignments to the task
        resourceAssignments.forEach(assignment => {
            task.addResource(assignment.resourceId, assignment.hoursPerDay, assignment.role);
        });

        closeModal();
        renderHierarchy();
        renderCanvas();
        updateStats();
        saveToLocalStorage();
    } catch (err) {
        alert(err.message);
    }
}

// ===== DELETE OPERATIONS =====

function deleteObjective(id) {
    if (!confirm('Delete this objective and all its tactics, initiatives, and tasks?')) return;
    
    systemicState.deleteObjective(id);
    renderHierarchy();
    renderCanvas();
    updateStats();
    saveToLocalStorage();
}

function deleteTactic(objectiveId, tacticId) {
    if (!confirm('Delete this tactic and all its initiatives and tasks?')) return;
    
    systemicState.deleteTactic(objectiveId, tacticId);
    renderHierarchy();
    renderCanvas();
    updateStats();
    saveToLocalStorage();
}

function deleteInitiative(objectiveId, tacticId, initiativeId) {
    if (!confirm('Delete this initiative and all its tasks?')) return;
    
    systemicState.deleteInitiative(objectiveId, tacticId, initiativeId);
    renderHierarchy();
    renderCanvas();
    updateStats();
    saveToLocalStorage();
}

function deleteTask(objectiveId, tacticId, initiativeId, taskId) {
    if (!confirm('Delete this task?')) return;
    
    systemicState.deleteTask(objectiveId, tacticId, initiativeId, taskId);
    renderHierarchy();
    renderCanvas();
    updateStats();
    saveToLocalStorage();
}

// ===== EDIT OPERATIONS =====

function editItem(type, ...ids) {
    switch(type) {
        case 'objective':
            editObjective(ids[0]);
            break;
        case 'tactic':
            editTactic(ids[0], ids[1]);
            break;
        case 'initiative':
            editInitiative(ids[0], ids[1], ids[2]);
            break;
        case 'task':
            editTask(ids[0], ids[1], ids[2], ids[3]);
            break;
    }
}

function editObjective(objectiveId) {
    const objective = systemicState.getObjective(objectiveId);
    if (!objective) return;

    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    content.innerHTML = `
        <h2>Edit Objective (Strategic Goal)</h2>
        <p class="form-subtitle">3-5 year timeline</p>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="objTitle" placeholder="Enter objective title" value="${objective.title}">
        </div>
        <div class="form-group">
            <label>Start Year:</label>
            <input type="number" id="objStartYear" value="${objective.startYear}" min="2020" max="2050">
        </div>
        <div class="form-group">
            <label>End Year:</label>
            <input type="number" id="objEndYear" value="${objective.endYear}" min="2020" max="2050">
        </div>
        <div class="form-group">
            <label>Description (Optional):</label>
            <textarea id="objDescription" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">${objective.description || ''}</textarea>
        </div>
        <div class="form-actions">
            <button onclick="updateObjective(${objectiveId})" class="btn btn-primary">Update</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';
}

function updateObjective(objectiveId) {
    const objective = systemicState.getObjective(objectiveId);
    if (!objective) return;

    const title = document.getElementById('objTitle').value.trim();
    const startYear = parseInt(document.getElementById('objStartYear').value);
    const endYear = parseInt(document.getElementById('objEndYear').value);
    const description = document.getElementById('objDescription').value.trim();

    if (!title) {
        alert('Please enter a title');
        return;
    }

    if (endYear <= startYear) {
        alert('End year must be after start year');
        return;
    }

    if (endYear - startYear < 3 || endYear - startYear > 5) {
        alert('Objectives should be 3-5 years');
        return;
    }

    objective.title = title;
    objective.startYear = startYear;
    objective.endYear = endYear;
    objective.description = description;

    closeModal();
    renderHierarchy();
    renderCanvas();
    saveToLocalStorage();
}

function editTactic(objectiveId, tacticId) {
    const tactic = systemicState.getTactic(objectiveId, tacticId);
    const objective = systemicState.getObjective(objectiveId);
    if (!tactic || !objective) return;

    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    content.innerHTML = `
        <h2>Edit Tactic / Boulder</h2>
        <p class="form-subtitle">1-2 year timeline for Objective: ${objective.title}</p>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="tacticTitle" placeholder="Enter tactic title" value="${tactic.title}">
        </div>
        <div class="form-group">
            <label>Start Quarter:</label>
            <input type="text" id="tacticStartQ" placeholder="e.g., 2024-Q1" value="${tactic.startQuarter}">
        </div>
        <div class="form-group">
            <label>End Quarter:</label>
            <input type="text" id="tacticEndQ" placeholder="e.g., 2025-Q4" value="${tactic.endQuarter}">
        </div>
        <div class="form-group">
            <label>Description (Optional):</label>
            <textarea id="tacticDescription" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">${tactic.description || ''}</textarea>
        </div>
        <div class="form-actions">
            <button onclick="updateTactic(${objectiveId}, ${tacticId})" class="btn btn-primary">Update</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';
}

function updateTactic(objectiveId, tacticId) {
    const tactic = systemicState.getTactic(objectiveId, tacticId);
    if (!tactic) return;

    const title = document.getElementById('tacticTitle').value.trim();
    const startQ = document.getElementById('tacticStartQ').value.trim();
    const endQ = document.getElementById('tacticEndQ').value.trim();
    const description = document.getElementById('tacticDescription').value.trim();

    if (!title) {
        alert('Please enter a title');
        return;
    }

    tactic.title = title;
    tactic.startQuarter = startQ;
    tactic.endQuarter = endQ;
    tactic.description = description;

    closeModal();
    renderHierarchy();
    renderCanvas();
    saveToLocalStorage();
}

function editInitiative(objectiveId, tacticId, initiativeId) {
    const initiative = systemicState.getInitiative(objectiveId, tacticId, initiativeId);
    const tactic = systemicState.getTactic(objectiveId, tacticId);
    if (!initiative || !tactic) return;

    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    content.innerHTML = `
        <h2>Edit Initiative / Action Plan / Rock</h2>
        <p class="form-subtitle">1-5 quarter project for Tactic: ${tactic.title}</p>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="initTitle" placeholder="Enter initiative title" value="${initiative.title}">
        </div>
        <div class="form-group">
            <label>Start Quarter:</label>
            <input type="text" id="initStartQ" placeholder="e.g., 2024-Q1" value="${initiative.startQuarter}">
        </div>
        <div class="form-group">
            <label>Duration (Quarters):</label>
            <input type="number" id="initDuration" min="1" max="5" value="${initiative.durationQuarters}">
        </div>
        <div class="form-group">
            <label>Description (Optional):</label>
            <textarea id="initDescription" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">${initiative.description || ''}</textarea>
        </div>
        <div class="form-actions">
            <button onclick="updateInitiative(${objectiveId}, ${tacticId}, ${initiativeId})" class="btn btn-primary">Update</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';
}

function updateInitiative(objectiveId, tacticId, initiativeId) {
    const initiative = systemicState.getInitiative(objectiveId, tacticId, initiativeId);
    if (!initiative) return;

    const title = document.getElementById('initTitle').value.trim();
    const startQ = document.getElementById('initStartQ').value.trim();
    const duration = parseInt(document.getElementById('initDuration').value);
    const description = document.getElementById('initDescription').value.trim();

    if (!title) {
        alert('Please enter a title');
        return;
    }

    if (duration < 1 || duration > 5) {
        alert('Duration must be 1-5 quarters');
        return;
    }

    initiative.title = title;
    initiative.startQuarter = startQ;
    initiative.durationQuarters = duration;
    initiative.description = description;

    closeModal();
    renderHierarchy();
    renderCanvas();
    saveToLocalStorage();
}

function editTask(objectiveId, tacticId, initiativeId, taskId) {
    const task = systemicState.getTask(objectiveId, tacticId, initiativeId, taskId);
    const initiative = systemicState.getInitiative(objectiveId, tacticId, initiativeId);
    if (!task || !initiative) return;

    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    // Build multi-resource selection with checkboxes (pre-selected based on task)
    let resourceCheckboxes = '';
    if (systemicState.resources.length === 0) {
        resourceCheckboxes = '<p style="color: #999; font-size: 12px;">No resources available. Add resources first.</p>';
    } else {
        systemicState.resources.forEach(r => {
            const assignment = task.resourceAssignments.find(ra => ra.resourceId === r.id);
            const isChecked = assignment ? 'checked' : '';
            const hoursValue = assignment ? assignment.hoursPerDay : 8;
            const hoursDisabled = assignment ? '' : 'disabled';

            resourceCheckboxes += `
                <div style="margin-bottom: 8px; padding: 6px; background: #f9f9f9; border-radius: 4px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" class="resource-checkbox" value="${r.id}" data-name="${r.name}" ${isChecked}>
                        <span>${r.getTypeIcon()} ${r.name}</span>
                        <input type="number" class="resource-hours" data-resource="${r.id}"
                               placeholder="hrs/day" min="1" max="24" value="${hoursValue}"
                               style="width: 70px; margin-left: auto; padding: 4px; font-size: 12px;"
                               ${hoursDisabled}>
                    </label>
                </div>
            `;
        });
    }

    content.innerHTML = `
        <h2>Edit Task / To-Do</h2>
        <p class="form-subtitle">1-90 day action item for Initiative: ${initiative.title}</p>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="taskTitle" placeholder="Enter task title" value="${task.title}">
        </div>
        <div class="form-group">
            <label>Duration (Days):</label>
            <input type="number" id="taskDuration" min="1" max="90" value="${task.durationDays}">
        </div>
        <div class="form-group">
            <label>Resources (Select Multiple):</label>
            <div id="taskResourcesContainer" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
                ${resourceCheckboxes}
            </div>
            <p style="font-size: 11px; color: #666; margin-top: 5px;">
                💡 Check resources and set hours/day for each. Tasks can use multiple resources simultaneously.
            </p>
        </div>
        <div class="form-group">
            <label>Description (Optional):</label>
            <textarea id="taskDescription" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">${task.description || ''}</textarea>
        </div>
        <div class="form-actions">
            <button onclick="updateTask(${objectiveId}, ${tacticId}, ${initiativeId}, ${taskId})" class="btn btn-primary">Update</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';

    // Add event listeners to enable/disable hours input when checkbox is toggled
    document.querySelectorAll('.resource-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const resourceId = e.target.value;
            const hoursInput = document.querySelector(`.resource-hours[data-resource="${resourceId}"]`);
            if (hoursInput) {
                hoursInput.disabled = !e.target.checked;
                if (e.target.checked && !hoursInput.value) {
                    hoursInput.value = 8; // Default to 8 hours/day
                }
            }
        });
    });
}

function updateTask(objectiveId, tacticId, initiativeId, taskId) {
    const task = systemicState.getTask(objectiveId, tacticId, initiativeId, taskId);
    if (!task) return;

    const title = document.getElementById('taskTitle').value.trim();
    const duration = parseInt(document.getElementById('taskDuration').value);
    const description = document.getElementById('taskDescription').value.trim();

    if (!title) {
        alert('Please enter a title');
        return;
    }

    if (duration < 1 || duration > 90) {
        alert('Duration must be between 1 and 90 days');
        return;
    }

    // Collect selected resources and their hours
    const newResourceAssignments = [];
    document.querySelectorAll('.resource-checkbox:checked').forEach(checkbox => {
        const resourceId = parseInt(checkbox.value);
        const hoursInput = document.querySelector(`.resource-hours[data-resource="${resourceId}"]`);
        const hoursPerDay = hoursInput ? parseInt(hoursInput.value) || 8 : 8;

        newResourceAssignments.push({
            resourceId: resourceId,
            hoursPerDay: hoursPerDay,
            role: 'primary'
        });
    });

    // Update task properties
    task.title = title;
    task.durationDays = duration;
    task.nominalDuration = duration;
    task.ccpmDuration = Math.max(1, Math.ceil(duration / 2));
    task.safetyTime = duration - task.ccpmDuration;
    task.description = description;

    // Replace resource assignments
    task.resourceAssignments = newResourceAssignments;

    closeModal();
    renderHierarchy();
    renderCanvas();
    saveToLocalStorage();
}

// ===== UPDATE OPERATIONS =====

function updateTaskProgress(objectiveId, tacticId, initiativeId, taskId, progress) {
    const task = systemicState.getTask(objectiveId, tacticId, initiativeId, taskId);
    if (!task) return;

    task.progress = parseInt(progress);

    if (task.progress > 0 && task.status === 'not_started') {
        task.status = 'in_progress';
    }
    if (task.progress === 100) {
        task.status = 'completed';
    }

    systemicState.calculateAllProgress();
    renderHierarchy();
    renderCanvas();
    updateStats();
    saveToLocalStorage();
}

// ===== RESOURCES =====

function showAddResourceForm() {
    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    content.innerHTML = `
        <h2>Add Resource</h2>
        <div class="form-group">
            <label>Name:</label>
            <input type="text" id="resourceName" placeholder="Enter resource name" required>
        </div>
        <div class="form-group">
            <label>Type:</label>
            <select id="resourceType">
                <option value="person">👤 Person</option>
                <option value="skill_pool">👥 Skill Pool / Role</option>
                <option value="decision_maker">👔 Decision Maker</option>
                <option value="equipment">⚙️ Equipment</option>
                <option value="space">📍 Space / Location</option>
                <option value="financial">💰 Financial / Budget</option>
                <option value="supplier">🏭 Supplier</option>
            </select>
        </div>
        <div class="form-group">
            <label>Capacity (units/FTEs):</label>
            <input type="number" id="resourceCapacity" min="1" value="1" step="0.1">
        </div>
        <div class="form-group">
            <label>Availability (%):</label>
            <input type="number" id="resourceAvailability" min="1" max="100" value="80">
        </div>
        <div class="form-group">
            <label>Load Limit (%):</label>
            <input type="number" id="resourceLoadLimit" min="1" max="100" value="75">
            <small style="color: #666;">70-80% recommended for realistic planning</small>
        </div>
        <div class="form-group">
            <label>Max Hours/Day:</label>
            <input type="number" id="resourceMaxPerDay" min="1" max="24" value="8">
        </div>
        <div class="form-group">
            <label>Role/Title (optional):</label>
            <input type="text" id="resourceRole" placeholder="e.g., Owner, Designer, CFO">
        </div>
        <div class="form-group">
            <label style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" id="resourceIsDrum">
                Mark as Drum Resource (throughput constraint)
            </label>
        </div>
        <div class="form-group">
            <label style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" id="resourceIsShared">
                Shared across multiple projects
            </label>
        </div>
        <div class="form-actions">
            <button onclick="saveResource()" class="btn btn-primary">Save</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';
}

function saveResource() {
    const name = document.getElementById('resourceName').value.trim();
    if (!name) {
        alert('Please enter a name');
        return;
    }

    const type = document.getElementById('resourceType').value;
    const resource = systemicState.addResource(name, type);

    resource.capacity = parseFloat(document.getElementById('resourceCapacity').value);
    resource.availabilityPercent = parseInt(document.getElementById('resourceAvailability').value);
    resource.loadLimitPercent = parseInt(document.getElementById('resourceLoadLimit').value);
    resource.maxCapacityPerDay = parseInt(document.getElementById('resourceMaxPerDay').value);
    resource.role = document.getElementById('resourceRole').value.trim();
    resource.isDrumResource = document.getElementById('resourceIsDrum').checked;
    resource.isSharedAcrossProjects = document.getElementById('resourceIsShared').checked;

    closeModal();
    renderResourceList();
    saveToLocalStorage();
}

function renderResourceList() {
    const list = document.getElementById('resourceList');
    if (!list) return;

    list.innerHTML = '';

    // Add button to load common resources
    const loadCommonBtn = document.createElement('button');
    loadCommonBtn.className = 'btn btn-secondary';
    loadCommonBtn.style.width = '100%';
    loadCommonBtn.style.marginBottom = '15px';
    loadCommonBtn.textContent = '📦 Load Common Resources';
    loadCommonBtn.onclick = loadCommonResources;
    list.appendChild(loadCommonBtn);

    // Group resources by type
    const groupedResources = {};
    systemicState.resources.forEach(r => {
        if (!groupedResources[r.type]) {
            groupedResources[r.type] = [];
        }
        groupedResources[r.type].push(r);
    });

    // Display resources by type
    Object.keys(groupedResources).sort().forEach(type => {
        const typeHeader = document.createElement('div');
        typeHeader.style.fontWeight = 'bold';
        typeHeader.style.marginTop = '10px';
        typeHeader.style.marginBottom = '5px';
        typeHeader.style.fontSize = '12px';
        typeHeader.style.color = '#667eea';
        typeHeader.textContent = type.replace('_', ' ').toUpperCase();
        list.appendChild(typeHeader);

        groupedResources[type].forEach(r => {
            const div = document.createElement('div');
            div.className = 'resource-item';
            div.style.marginBottom = '5px';
            div.style.padding = '8px';
            div.style.borderRadius = '4px';
            div.style.background = r.isDrumResource ? '#fff3e0' : (r.isSharedAcrossProjects ? '#e3f2fd' : '#f9f9f9');

            const effectiveCapacity = r.getEffectiveCapacity().toFixed(2);
            const badges = [];
            if (r.isDrumResource) badges.push('<span style="background:#ff9800;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-left:5px;">DRUM</span>');
            if (r.isSharedAcrossProjects) badges.push('<span style="background:#2196f3;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-left:5px;">SHARED</span>');

            div.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="flex:1;">
                        <div style="font-weight:600;cursor:pointer;" onclick="editResource(${r.id})">
                            ${r.getTypeIcon()} ${r.name}
                            ${badges.join('')}
                        </div>
                        <div style="font-size:10px;color:#666;margin-top:2px;">
                            ${r.capacity} × ${r.availabilityPercent}% × ${r.loadLimitPercent}% = ${effectiveCapacity} effective
                            ${r.role ? ' | ' + r.role : ''}
                        </div>
                    </div>
                    <button onclick="deleteResource(${r.id})" class="btn-remove">×</button>
                </div>
            `;
            list.appendChild(div);
        });
    });

    if (systemicState.resources.length === 0) {
        list.innerHTML += '<div style="text-align:center;padding:20px;color:#999;font-size:12px;">No resources yet. Click "Load Common Resources" to start.</div>';
    }
}

function editResource(id) {
    const resource = systemicState.getResource(id);
    if (!resource) return;

    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');

    content.innerHTML = `
        <h2>Edit Resource</h2>
        <div class="form-group">
            <label>Name:</label>
            <input type="text" id="resourceName" value="${resource.name}" required>
        </div>
        <div class="form-group">
            <label>Type:</label>
            <select id="resourceType">
                <option value="person" ${resource.type === 'person' ? 'selected' : ''}>👤 Person</option>
                <option value="skill_pool" ${resource.type === 'skill_pool' ? 'selected' : ''}>👥 Skill Pool / Role</option>
                <option value="decision_maker" ${resource.type === 'decision_maker' ? 'selected' : ''}>👔 Decision Maker</option>
                <option value="equipment" ${resource.type === 'equipment' ? 'selected' : ''}>⚙️ Equipment</option>
                <option value="space" ${resource.type === 'space' ? 'selected' : ''}>📍 Space / Location</option>
                <option value="financial" ${resource.type === 'financial' ? 'selected' : ''}>💰 Financial / Budget</option>
                <option value="supplier" ${resource.type === 'supplier' ? 'selected' : ''}>🏭 Supplier</option>
            </select>
        </div>
        <div class="form-group">
            <label>Capacity (units/FTEs):</label>
            <input type="number" id="resourceCapacity" min="1" value="${resource.capacity}" step="0.1">
        </div>
        <div class="form-group">
            <label>Availability (%):</label>
            <input type="number" id="resourceAvailability" min="1" max="100" value="${resource.availabilityPercent}">
        </div>
        <div class="form-group">
            <label>Load Limit (%):</label>
            <input type="number" id="resourceLoadLimit" min="1" max="100" value="${resource.loadLimitPercent}">
        </div>
        <div class="form-group">
            <label>Max Hours/Day:</label>
            <input type="number" id="resourceMaxPerDay" min="1" max="24" value="${resource.maxCapacityPerDay}">
        </div>
        <div class="form-group">
            <label>Role/Title:</label>
            <input type="text" id="resourceRole" value="${resource.role}">
        </div>
        <div class="form-group">
            <label style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" id="resourceIsDrum" ${resource.isDrumResource ? 'checked' : ''}>
                Mark as Drum Resource (throughput constraint)
            </label>
        </div>
        <div class="form-group">
            <label style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" id="resourceIsShared" ${resource.isSharedAcrossProjects ? 'checked' : ''}>
                Shared across multiple projects
            </label>
        </div>
        <div class="form-actions">
            <button onclick="updateResource(${id})" class="btn btn-primary">Update</button>
            <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
        </div>
    `;

    modal.style.display = 'block';
}

function updateResource(id) {
    const resource = systemicState.getResource(id);
    if (!resource) return;

    resource.name = document.getElementById('resourceName').value.trim();
    resource.type = document.getElementById('resourceType').value;
    resource.capacity = parseFloat(document.getElementById('resourceCapacity').value);
    resource.availabilityPercent = parseInt(document.getElementById('resourceAvailability').value);
    resource.loadLimitPercent = parseInt(document.getElementById('resourceLoadLimit').value);
    resource.maxCapacityPerDay = parseInt(document.getElementById('resourceMaxPerDay').value);
    resource.role = document.getElementById('resourceRole').value.trim();
    resource.isDrumResource = document.getElementById('resourceIsDrum').checked;
    resource.isSharedAcrossProjects = document.getElementById('resourceIsShared').checked;

    closeModal();
    renderResourceList();
    saveToLocalStorage();
}

function loadCommonResources() {
    if (systemicState.resources.length > 0) {
        if (!confirm('This will add common resource templates. Continue?')) {
            return;
        }
    }

    systemicState.loadCommonResources();
    renderResourceList();
    saveToLocalStorage();
    alert('Common resources loaded! You can now edit them to match your needs.');
}

function deleteResource(id) {
    if (!confirm('Delete this resource?')) return;
    systemicState.deleteResource(id);
    renderResourceList();
    saveToLocalStorage();
}

// ===== CANVAS RENDERING =====

function renderCanvas() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (systemicState.objectives.length === 0) {
        drawEmptyState();
        return;
    }

    // Render based on current view
    switch (currentView) {
        case 'timeline':
            drawTimeline();
            break;
        case 'resourceLoad':
            drawResourceLoad();
            break;
        case 'buffers':
            drawBufferChart();
            break;
        case 'calendar':
            drawResourceCalendar();
            break;
        case 'priority':
            drawPriorityQueue();
            break;
        default:
            drawTimeline();
    }
}

function drawEmptyState() {
    ctx.fillStyle = '#666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Add objectives to see systemic timeline visualization', canvas.width / 2, canvas.height / 2);
}

function drawTimeline() {
    const padding = 60;
    const leftMargin = 250; // Space for labels
    const rowHeight = 45;
    const barHeight = 32;
    const indent = 20;
    let y = padding;

    ctx.font = '13px Arial';
    ctx.textAlign = 'left';

    // Calculate year range for timeline
    let minYear = 9999, maxYear = 0;
    systemicState.objectives.forEach(obj => {
        minYear = Math.min(minYear, obj.startYear);
        maxYear = Math.max(maxYear, obj.endYear);
    });

    if (minYear === 9999) return; // No objectives

    const yearRange = maxYear - minYear + 1;
    const timelineWidth = Math.max(canvas.width - leftMargin - padding * 2, 600);
    const pixelsPerYear = timelineWidth / yearRange;

    // Draw year axis
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftMargin, padding - 20);
    ctx.lineTo(leftMargin + timelineWidth, padding - 20);
    ctx.stroke();

    // Draw year labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    for (let year = minYear; year <= maxYear; year++) {
        const x = leftMargin + (year - minYear) * pixelsPerYear;
        ctx.fillText(year.toString(), x, padding - 25);
        ctx.beginPath();
        ctx.moveTo(x, padding - 22);
        ctx.lineTo(x, padding - 18);
        ctx.stroke();
    }

    // Color scheme for hierarchy levels
    const colors = {
        objective: '#667eea',
        tactic: '#ff9800',
        initiative: '#009688',
        task: '#9c27b0'
    };

    ctx.font = '13px Arial';
    ctx.textAlign = 'left';

    // Draw each objective with its hierarchy
    systemicState.objectives.forEach((obj, objIdx) => {
        // Draw Objective
        const objStartX = leftMargin + (obj.startYear - minYear) * pixelsPerYear;
        const objWidth = (obj.endYear - obj.startYear) * pixelsPerYear;

        // Label
        ctx.fillStyle = '#333';
        ctx.fillText(`📋 ${obj.title}`, padding, y + barHeight / 2 + 5);

        // Progress bar background
        ctx.fillStyle = colors.objective;
        ctx.fillRect(objStartX, y, objWidth, barHeight);

        // Progress overlay
        if (obj.progress > 0) {
            ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
            ctx.fillRect(objStartX, y, objWidth * (obj.progress / 100), barHeight);
        }

        // Border
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.strokeRect(objStartX, y, objWidth, barHeight);

        // Progress text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${obj.progress}%`, objStartX + objWidth / 2, y + barHeight / 2 + 4);

        y += rowHeight;

        // Draw Tactics
        obj.tactics.forEach((tactic, tacIdx) => {
            const tacStartX = leftMargin + estimateQuarterPosition(tactic.startQuarter, minYear, pixelsPerYear);
            const tacEndX = leftMargin + estimateQuarterPosition(tactic.endQuarter, minYear, pixelsPerYear);
            const tacWidth = tacEndX - tacStartX;

            // Label with indent
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#555';
            ctx.fillText(`🎯 ${tactic.title}`, padding + indent, y + barHeight / 2 + 5);

            // Bar
            ctx.fillStyle = colors.tactic;
            ctx.fillRect(tacStartX, y, tacWidth, barHeight - 6);

            // Progress overlay
            if (tactic.progress > 0) {
                ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
                ctx.fillRect(tacStartX, y, tacWidth * (tactic.progress / 100), barHeight - 6);
            }

            // Border
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.strokeRect(tacStartX, y, tacWidth, barHeight - 6);

            // Progress text
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${tactic.progress}%`, tacStartX + tacWidth / 2, y + (barHeight - 6) / 2 + 3);

            y += rowHeight - 5;

            // Draw Initiatives
            tactic.initiatives.forEach((initiative, initIdx) => {
                const initStartX = leftMargin + estimateQuarterPosition(initiative.startQuarter, minYear, pixelsPerYear);
                const initWidth = pixelsPerYear * (initiative.durationQuarters / 4); // Quarters to years

                // Label with more indent
                ctx.font = '11px Arial';
                ctx.textAlign = 'left';
                ctx.fillStyle = '#666';
                ctx.fillText(`🚀 ${initiative.title}`, padding + indent * 2, y + (barHeight - 10) / 2 + 4);

                // Bar
                ctx.fillStyle = colors.initiative;
                ctx.fillRect(initStartX, y, initWidth, barHeight - 12);

                // Progress overlay
                if (initiative.progress > 0) {
                    ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
                    ctx.fillRect(initStartX, y, initWidth * (initiative.progress / 100), barHeight - 12);
                }

                // Border
                ctx.strokeStyle = '#777';
                ctx.lineWidth = 1;
                ctx.strokeRect(initStartX, y, initWidth, barHeight - 12);

                // Progress text
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 9px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${initiative.progress}%`, initStartX + initWidth / 2, y + (barHeight - 12) / 2 + 3);

                y += rowHeight - 15;

                // Draw Tasks (simplified, shown as small segments)
                if (initiative.tasks.length > 0) {
                    const taskY = y;
                    let taskX = initStartX;
                    const avgTaskWidth = initWidth / initiative.tasks.length;

                    initiative.tasks.forEach((task, taskIdx) => {
                        const taskWidth = Math.max(avgTaskWidth * 0.8, 15);

                        // Mini bar for task
                        let taskColor = colors.task;
                        if (task.status === 'completed') taskColor = '#4caf50';
                        else if (task.status === 'in_progress') taskColor = '#2196f3';

                        ctx.fillStyle = taskColor;
                        ctx.fillRect(taskX, taskY, taskWidth, barHeight - 18);

                        // Border
                        ctx.strokeStyle = '#888';
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(taskX, taskY, taskWidth, barHeight - 18);

                        taskX += avgTaskWidth;
                    });

                    // Task count label
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillStyle = '#777';
                    ctx.fillText(`✓ ${initiative.tasks.length} tasks`, padding + indent * 3, taskY + (barHeight - 18) / 2 + 3);

                    y += rowHeight - 20;
                }
            });
        });

        // Add spacing between objectives
        y += 15;
    });

    // Draw legend at bottom
    drawLegend(leftMargin, y + 20, colors);

    // Set canvas height based on content
    if (y + 100 > canvas.height) {
        canvas.height = y + 100;
    }
}

// Helper function to estimate pixel position from quarter string
function estimateQuarterPosition(quarterStr, minYear, pixelsPerYear) {
    // Parse "2024-Q1" format
    const match = quarterStr.match(/(\d{4})-Q(\d)/);
    if (!match) return 0;

    const year = parseInt(match[1]);
    const quarter = parseInt(match[2]);

    const yearOffset = (year - minYear) * pixelsPerYear;
    const quarterOffset = ((quarter - 1) / 4) * pixelsPerYear;

    return yearOffset + quarterOffset;
}

// Draw legend for the timeline
function drawLegend(x, y, colors) {
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';

    const legendItems = [
        { label: 'Objective (3-5yr)', color: colors.objective },
        { label: 'Tactic/Boulder (1-2yr)', color: colors.tactic },
        { label: 'Initiative/Rock (1-5Q)', color: colors.initiative },
        { label: 'Task/To-Do (1-90d)', color: colors.task },
        { label: 'Completed', color: '#4caf50' },
        { label: 'In Progress', color: '#2196f3' }
    ];

    let legendX = x;
    legendItems.forEach((item, idx) => {
        // Color box
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, y, 20, 12);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(legendX, y, 20, 12);

        // Label
        ctx.fillStyle = '#333';
        ctx.fillText(item.label, legendX + 25, y + 10);

        legendX += 150;
        if (idx === 3) { // New row after 4 items
            legendX = x;
            y += 20;
        }
    });
}

function drawPriorityQueue() {
    const padding = 60;
    const leftMargin = 200;

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Priority Queue - "What\'s My Next Task?"', padding, 40);

    // Check if DBR system exists
    if (!systemicState.drumBufferRope) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('Priority queue not yet created', canvas.width / 2, canvas.height / 2);
        ctx.fillText('Click "Schedule Project" to generate priority queue', canvas.width / 2, canvas.height / 2 + 25);
        return;
    }

    if (systemicState.resources.length === 0) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No resources defined', canvas.width / 2, canvas.height / 2);
        return;
    }

    const dbr = systemicState.drumBufferRope;
    let y = padding + 60;
    const rowHeight = 120;

    // Draw each resource and their next task
    systemicState.resources.forEach((resource, idx) => {
        if (y > canvas.height - padding) return; // Don't overflow

        // Resource header
        ctx.fillStyle = '#667eea';
        ctx.fillRect(padding, y, canvas.width - padding * 2, 30);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${resource.getTypeIcon()} ${resource.name}`, padding + 15, y + 20);

        // Get next task for this resource
        const nextTaskInfo = dbr.getNextTaskForResource(resource.id);

        y += 35;

        if (!nextTaskInfo.task) {
            // No task available
            ctx.fillStyle = '#999';
            ctx.font = '13px Arial';
            ctx.fillText('✓ No tasks currently available', padding + 15, y + 20);
            ctx.font = '11px Arial';
            ctx.fillText(`Reason: ${nextTaskInfo.reason}`, padding + 15, y + 40);
        } else {
            const task = nextTaskInfo.task;

            // Task title
            ctx.fillStyle = task.isCriticalChain ? '#f44336' : '#333';
            ctx.font = nextTaskInfo.isActive ? 'bold 14px Arial' : '13px Arial';
            const statusPrefix = nextTaskInfo.isActive ? '🔴 CONTINUE: ' : '▶️ START: ';
            ctx.fillText(`${statusPrefix}"${task.title}"`, padding + 15, y + 20);

            // Priority reason
            ctx.fillStyle = '#666';
            ctx.font = '11px Arial';
            ctx.fillText(`Priority: ${nextTaskInfo.reason}`, padding + 15, y + 40);

            // Duration and schedule
            const schedStart = task.scheduledStart !== null ? task.scheduledStart.toFixed(1) : '?';
            const schedEnd = task.scheduledEnd !== null ? task.scheduledEnd.toFixed(1) : '?';
            ctx.fillText(`Duration: ${task.ccpmDuration}d | Scheduled: Day ${schedStart} - ${schedEnd}`, padding + 15, y + 55);

            // Buffer status if available
            if (nextTaskInfo.bufferStatus) {
                const bs = nextTaskInfo.bufferStatus;
                let bufferColor = '#4caf50';
                if (bs.status === 'red') bufferColor = '#f44336';
                else if (bs.status === 'yellow') bufferColor = '#ff9800';

                ctx.fillStyle = bufferColor;
                ctx.fillRect(padding + 15, y + 60, 100, 20);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${bs.bufferId}: ${bs.penetration.toFixed(0)}%`, padding + 65, y + 73);
                ctx.textAlign = 'left';

                ctx.fillStyle = '#666';
                ctx.font = '10px Arial';
                ctx.fillText(`${bs.bufferType} buffer`, padding + 125, y + 73);
            }
        }

        y += rowHeight;

        // Separator line
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, y - 10);
        ctx.lineTo(canvas.width - padding, y - 10);
        ctx.stroke();
    });

    // Instructions at bottom
    ctx.fillStyle = '#666';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Each resource shows their highest-priority task. Red = Critical Chain | Buffer status drives priority.', padding, canvas.height - 20);
}

// ===== VIEW SWITCHING =====

function switchView(view) {
    currentView = view;

    // Update tab button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Re-render canvas
    renderCanvas();
}

// ===== ADDITIONAL VISUALIZATIONS =====

function drawResourceLoad() {
    const padding = 60;
    const leftMargin = 200;
    const chartWidth = canvas.width - leftMargin - padding * 2;
    const chartHeight = canvas.height - padding * 2;

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Resource Utilization', padding, 40);

    // Calculate resource loads
    const resourceLoads = systemicState.calculateResourceLoad();

    if (resourceLoads.size === 0 || systemicState.resources.length === 0) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No resources assigned to tasks yet', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Prepare data
    const resourceData = [];
    systemicState.resources.forEach(resource => {
        const load = resourceLoads.get(resource.id) || { utilizationPercent: 0, totalDays: 0 };
        resourceData.push({
            name: resource.name,
            icon: resource.getTypeIcon(),
            utilization: Math.min(100, load.utilizationPercent),
            totalDays: load.totalDays,
            capacity: resource.getEffectiveCapacity() * 90, // 90-day window
            isDrum: resource.isDrumResource
        });
    });

    // Sort by utilization
    resourceData.sort((a, b) => b.utilization - a.utilization);

    const barHeight = 30;
    const barGap = 15;
    const maxBarWidth = chartWidth - 100;
    let y = padding + 60;

    // Draw bars
    resourceData.forEach((data, idx) => {
        if (y + barHeight > canvas.height - padding) return; // Don't overflow

        // Resource label
        ctx.fillStyle = '#333';
        ctx.font = '13px Arial';
        ctx.textAlign = 'right';
        const label = `${data.icon} ${data.name}`;
        ctx.fillText(label, leftMargin - 10, y + barHeight / 2 + 5);

        // Bar background
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(leftMargin, y, maxBarWidth, barHeight);

        // Utilization bar
        const barWidth = (data.utilization / 100) * maxBarWidth;
        let barColor = '#4caf50'; // Green
        if (data.utilization >= 90) barColor = '#f44336'; // Red (overloaded)
        else if (data.utilization >= 75) barColor = '#ff9800'; // Orange

        ctx.fillStyle = barColor;
        ctx.fillRect(leftMargin, y, barWidth, barHeight);

        // Utilization percentage
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        if (barWidth > 50) {
            ctx.fillText(`${data.utilization.toFixed(1)}%`, leftMargin + 10, y + barHeight / 2 + 5);
        } else {
            ctx.fillStyle = '#333';
            ctx.fillText(`${data.utilization.toFixed(1)}%`, leftMargin + barWidth + 10, y + barHeight / 2 + 5);
        }

        // Drum indicator
        if (data.isDrum) {
            ctx.fillStyle = '#9c27b0';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'right';
            ctx.fillText('DRUM', leftMargin + maxBarWidth + 50, y + barHeight / 2 + 5);
        }

        // Border
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftMargin, y, maxBarWidth, barHeight);

        y += barHeight + barGap;
    });

    // Legend
    y = canvas.height - 40;
    const legendItems = [
        { color: '#4caf50', label: '<75% Normal' },
        { color: '#ff9800', label: '75-90% High' },
        { color: '#f44336', label: '>90% Overloaded' }
    ];

    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    let legendX = padding;
    legendItems.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, y, 15, 15);
        ctx.strokeStyle = '#666';
        ctx.strokeRect(legendX, y, 15, 15);
        ctx.fillStyle = '#666';
        ctx.fillText(item.label, legendX + 20, y + 12);
        legendX += 150;
    });
}

function drawBufferChart() {
    const padding = 60;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2 - 50;

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Buffer Fever Chart', padding, 40);

    if (systemicState.buffers.length === 0) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No buffers defined yet', canvas.width / 2, canvas.height / 2);
        ctx.fillText('Buffers protect the critical chain from delays', canvas.width / 2, canvas.height / 2 + 25);
        return;
    }

    // Chart area
    const chartTop = padding + 50;
    const chartBottom = chartTop + chartHeight;
    const chartLeft = padding + 100;
    const chartRight = chartLeft + (chartWidth - 100);

    // Draw zones (Green, Yellow, Red)
    const greenZone = chartHeight * 0.33;
    const yellowZone = chartHeight * 0.33;
    const redZone = chartHeight * 0.34;

    // Red zone (top)
    ctx.fillStyle = 'rgba(244, 67, 54, 0.15)';
    ctx.fillRect(chartLeft, chartTop, chartRight - chartLeft, redZone);

    // Yellow zone (middle)
    ctx.fillStyle = 'rgba(255, 152, 0, 0.15)';
    ctx.fillRect(chartLeft, chartTop + redZone, chartRight - chartLeft, yellowZone);

    // Green zone (bottom)
    ctx.fillStyle = 'rgba(76, 175, 80, 0.15)';
    ctx.fillRect(chartLeft, chartTop + redZone + yellowZone, chartRight - chartLeft, greenZone);

    // Y-axis
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartTop);
    ctx.lineTo(chartLeft, chartBottom);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartBottom);
    ctx.lineTo(chartRight, chartBottom);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('100%', chartLeft - 10, chartTop + 5);
    ctx.fillText('66%', chartLeft - 10, chartTop + redZone + 5);
    ctx.fillText('33%', chartLeft - 10, chartTop + redZone + yellowZone + 5);
    ctx.fillText('0%', chartLeft - 10, chartBottom + 5);

    // Draw zone labels
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#f44336';
    ctx.fillText('RED ZONE', chartRight + 10, chartTop + redZone / 2);
    ctx.fillStyle = '#ff9800';
    ctx.fillText('YELLOW ZONE', chartRight + 10, chartTop + redZone + yellowZone / 2);
    ctx.fillStyle = '#4caf50';
    ctx.fillText('GREEN ZONE', chartRight + 10, chartTop + redZone + yellowZone + greenZone / 2);

    // Plot buffers
    const bufferWidth = (chartRight - chartLeft) / Math.max(systemicState.buffers.length, 1);

    systemicState.buffers.forEach((buffer, idx) => {
        const x = chartLeft + idx * bufferWidth + bufferWidth / 2;
        const penetrationY = chartBottom - (buffer.penetration / 100) * chartHeight;

        // Get color based on status
        let pointColor = '#4caf50'; // green
        if (buffer.status === 'red') pointColor = '#f44336';
        else if (buffer.status === 'yellow') pointColor = '#ff9800';

        // Draw point
        ctx.fillStyle = pointColor;
        ctx.beginPath();
        ctx.arc(x, penetrationY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Buffer label with ID and type
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(buffer.id, x, chartBottom + 18);
        ctx.fillText(`${buffer.penetration.toFixed(0)}%`, x, chartBottom + 30);

        // Connect with line if not first
        if (idx > 0) {
            const prevX = chartLeft + (idx - 1) * bufferWidth + bufferWidth / 2;
            const prevBuffer = systemicState.buffers[idx - 1];
            const prevY = chartBottom - (prevBuffer.penetration / 100) * chartHeight;

            ctx.strokeStyle = '#999';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(x, penetrationY);
            ctx.stroke();
        }
    });

    // Legend
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#666';
    ctx.fillText('Buffer consumption over time - Take action when entering RED zone', padding, canvas.height - 20);
}

function drawCriticalChainView() {
    const padding = 60;

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Critical Chain Analysis', padding, 40);

    // Identify critical chain
    const criticalChain = systemicState.identifyCriticalChain();
    const allTasks = systemicState.getAllTasks();

    if (allTasks.length === 0) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No tasks defined yet', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Draw similar to timeline but highlight critical chain
    const leftMargin = 250;
    const rowHeight = 40;
    const barHeight = 28;
    let y = padding + 60;

    ctx.font = '12px Arial';
    ctx.textAlign = 'left';

    // Calculate timeline range
    let minStart = Infinity, maxEnd = 0;
    allTasks.forEach(task => {
        const taskStart = 0; // Simplified - would need proper date calculation
        const taskEnd = task.durationDays;
        minStart = Math.min(minStart, taskStart);
        maxEnd = Math.max(maxEnd, taskEnd);
    });

    const timelineWidth = canvas.width - leftMargin - padding * 2;
    const totalDays = Math.max(maxEnd - minStart, 1);
    const pixelsPerDay = timelineWidth / totalDays;

    // Draw tasks
    allTasks.forEach((task, idx) => {
        if (y > canvas.height - padding) return;

        const isCritical = criticalChain.some(ct => ct.id === task.id);
        const taskWidth = task.durationDays * pixelsPerDay;
        const taskX = leftMargin + (idx * 10) % (timelineWidth - taskWidth); // Simplified positioning

        // Label
        ctx.fillStyle = isCritical ? '#f44336' : '#333';
        ctx.font = isCritical ? 'bold 12px Arial' : '12px Arial';
        const label = task.title + (isCritical ? ' ⚠️ CRITICAL' : '');
        ctx.fillText(label, padding, y + barHeight / 2 + 4);

        // Task bar
        ctx.fillStyle = isCritical ? '#f44336' : '#9c27b0';
        ctx.fillRect(taskX, y, taskWidth, barHeight);

        // Progress overlay
        if (task.progress > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(taskX, y, taskWidth * (task.progress / 100), barHeight);
        }

        // Border
        ctx.strokeStyle = isCritical ? '#c62828' : '#666';
        ctx.lineWidth = isCritical ? 2 : 1;
        ctx.strokeRect(taskX, y, taskWidth, barHeight);

        // Duration label
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        if (taskWidth > 40) {
            ctx.fillText(`${task.durationDays}d`, taskX + taskWidth / 2, y + barHeight / 2 + 4);
        }

        y += rowHeight;
    });

    // Legend
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    const legendY = canvas.height - 40;

    ctx.fillStyle = '#f44336';
    ctx.fillRect(padding, legendY, 20, 15);
    ctx.strokeRect(padding, legendY, 20, 15);
    ctx.fillStyle = '#666';
    ctx.fillText('Critical Chain (Resource-Constrained Path)', padding + 25, legendY + 12);

    ctx.fillStyle = '#9c27b0';
    ctx.fillRect(padding + 300, legendY, 20, 15);
    ctx.strokeRect(padding + 300, legendY, 20, 15);
    ctx.fillText('Non-Critical Tasks', padding + 325, legendY + 12);
}

function drawResourceCalendar() {
    const padding = 60;
    const leftMargin = 180;
    const dayWidth = 30;
    const rowHeight = 35;

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Resource Allocation Calendar', padding, 40);

    if (systemicState.resources.length === 0) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No resources defined yet', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Time range (show next 30 days)
    const startDay = 0;
    const numDays = 30;
    const calendarWidth = numDays * dayWidth;

    // Draw day headers
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';

    for (let day = 0; day < numDays; day++) {
        const x = leftMargin + day * dayWidth;
        if (day % 5 === 0) {
            ctx.fillText(`Day ${day}`, x + dayWidth / 2, padding + 40);
            // Week separator
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, padding + 50);
            ctx.lineTo(x, padding + 50 + systemicState.resources.length * rowHeight);
            ctx.stroke();
        }
    }

    // Draw resources and their allocations
    let y = padding + 60;

    systemicState.resources.forEach(resource => {
        // Resource label
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${resource.getTypeIcon()} ${resource.name}`, leftMargin - 10, y + rowHeight / 2 + 4);

        // Background row
        ctx.fillStyle = '#f9f9f9';
        ctx.fillRect(leftMargin, y, calendarWidth, rowHeight);

        // Find tasks assigned to this resource
        const allTasks = systemicState.getAllTasks();
        const resourceTasks = allTasks.filter(task => task.resourceId === resource.id);

        // Draw task allocations (simplified positioning)
        let taskOffset = 0;
        resourceTasks.forEach(task => {
            const taskWidth = Math.min(task.durationDays * dayWidth, calendarWidth - taskOffset * dayWidth);
            const taskX = leftMargin + taskOffset * dayWidth;

            // Task block
            ctx.fillStyle = resource.isDrumResource ? '#f44336' : '#667eea';
            ctx.fillRect(taskX, y + 3, taskWidth, rowHeight - 6);

            // Task label (if space)
            if (taskWidth > 50) {
                ctx.fillStyle = '#fff';
                ctx.font = '10px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(task.title.substring(0, 15), taskX + 5, y + rowHeight / 2 + 4);
            }

            // Border
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(taskX, y + 3, taskWidth, rowHeight - 6);

            taskOffset += task.durationDays;
            if (taskOffset >= numDays) return;
        });

        // Row border
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftMargin, y, calendarWidth, rowHeight);

        y += rowHeight;
    });

    // Legend
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#666';
    ctx.fillText('Shows when resources are allocated to tasks over the next 30 days', padding, canvas.height - 20);
}

// ===== UTILITY =====

function closeModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
}

function handleCanvasClick(e) {
    // Handle canvas interactions
}

function updateStats() {
    const stats = {
        objectives: systemicState.objectives.length,
        tactics: systemicState.getAllTactics().length,
        initiatives: systemicState.getAllInitiatives().length,
        tasks: systemicState.getAllTasks().length
    };

    if (document.getElementById('statObjectives')) {
        document.getElementById('statObjectives').textContent = stats.objectives;
    }
    if (document.getElementById('statTactics')) {
        document.getElementById('statTactics').textContent = stats.tactics;
    }
    if (document.getElementById('statInitiatives')) {
        document.getElementById('statInitiatives').textContent = stats.initiatives;
    }
    if (document.getElementById('statTasks')) {
        document.getElementById('statTasks').textContent = stats.tasks;
    }
}

function loadExamplePlan() {
    // Example systemic plan
    systemicState = new SystemicProjectState();
    systemicState.projectName = "Company Growth Strategy 2024-2027";

    // Objective 1
    const obj1 = systemicState.addObjective("Expand Market Share", 2024, 2027);
    const tac1 = systemicState.addTactic("Launch New Product Line", "2024-Q1", "2025-Q4", obj1.id);
    const init1 = systemicState.addInitiative("Develop MVP", "2024-Q1", 2, obj1.id, tac1.id);
    systemicState.addTask("Market Research", 30, obj1.id, tac1.id, init1.id);
    systemicState.addTask("Design Prototype", 45, obj1.id, tac1.id, init1.id);

    // Objective 2
    const obj2 = systemicState.addObjective("Improve Operational Efficiency", 2024, 2026);
    const tac2 = systemicState.addTactic("Implement Automation", "2024-Q2", "2025-Q2", obj2.id);
    const init2 = systemicState.addInitiative("Deploy AI Tools", "2024-Q2", 3, obj2.id, tac2.id);
    systemicState.addTask("Evaluate Vendors", 20, obj2.id, tac2.id, init2.id);
    systemicState.addTask("Pilot Program", 60, obj2.id, tac2.id, init2.id);

    renderHierarchy();
    renderResourceList();
    renderCanvas();
    updateStats();
    saveToLocalStorage();
}

// ===== CCPM SCHEDULING =====

function scheduleProject() {
    // Run CCPM scheduling algorithm
    const allTasks = systemicState.getAllTasks();
    const allResources = systemicState.resources;

    if (allTasks.length === 0) {
        alert('No tasks to schedule. Add tasks first.');
        return;
    }

    console.log(`Scheduling ${allTasks.length} tasks with ${allResources.length} resources...`);

    try {
        // Step 1: Run scheduling algorithm
        const scheduler = new CCPMScheduler(allTasks, allResources);
        const result = scheduler.calculateSchedule();

        // Update system state with scheduling results
        systemicState.criticalChain = result.criticalChain;

        // Step 2: Create and place buffers
        console.log('Creating CCPM buffers...');
        const bufferManager = new BufferManager(
            allTasks,
            allResources,
            result.criticalChain,
            result.feedingChains,
            result.projectDuration
        );

        const buffers = bufferManager.insertAllBuffers();

        // Update system state with buffers
        systemicState.buffers = buffers;

        // Step 3: Create Drum-Buffer-Rope priority queue
        console.log('Creating priority queue system...');
        const drumBufferRope = new DrumBufferRope(
            allTasks,
            allResources,
            buffers,
            result.criticalChain
        );

        // Store DBR instance globally for UI access
        systemicState.drumBufferRope = drumBufferRope;

        // Get buffer summary
        const bufferSummary = bufferManager.getBufferStatusSummary();

        // Show summary
        const criticalChainTaskTitles = result.criticalChain.map(t => t.title).join(', ');

        alert(`✅ Project Scheduled with CCPM Buffers!

📊 PROJECT SCHEDULE:
Duration: ${result.projectDuration} days (tasks only)
With Buffers: ${result.projectDuration + (buffers.find(b => b.type === 'project')?.size || 0)} days

🔴 CRITICAL CHAIN: ${result.criticalChain.length} tasks
${criticalChainTaskTitles}

🔵 FEEDING CHAINS: ${result.feedingChains.length}

🛡️ BUFFERS CREATED: ${buffers.length} total
  • Project Buffer: ${bufferSummary.byType.project} (protects completion date)
  • Feeding Buffers: ${bufferSummary.byType.feeding} (protect from feeding chain delays)
  • Resource Buffers: ${bufferSummary.byType.resource} (alert before constrained resources)
  • Drum Buffers: ${bufferSummary.byType.drum} (protect constraint resource)

✅ All tasks scheduled with late-start optimization
✅ Critical chain tasks marked in red
✅ Buffers sized at 50% of aggregated safety time
✅ Priority queue created for all resources

🎯 View Priority Queue tab to see "What's My Next Task?" for each resource.`);

        // Re-render everything
        renderHierarchy();
        renderCanvas();
        updateStats();
        saveToLocalStorage();

        console.log('Scheduling complete:', result);

    } catch (error) {
        console.error('Scheduling error:', error);
        alert(`❌ Scheduling Failed\n\nError: ${error.message}\n\nCheck console for details.`);
    }
}

function clearAll() {
    if (!confirm('Clear entire systemic plan?')) return;

    systemicState = new SystemicProjectState();
    renderHierarchy();
    renderResourceList();
    renderCanvas();
    updateStats();
    saveToLocalStorage();
}

// Make functions globally accessible
window.showAddTacticForm = showAddTacticForm;
window.saveTactic = saveTactic;
window.showAddInitiativeForm = showAddInitiativeForm;
window.saveInitiative = saveInitiative;
window.showAddTaskForm = showAddTaskForm;
window.saveTask = saveTask;
window.deleteObjective = deleteObjective;
window.deleteTactic = deleteTactic;
window.deleteInitiative = deleteInitiative;
window.deleteTask = deleteTask;
window.editItem = editItem;
window.updateObjective = updateObjective;
window.updateTactic = updateTactic;
window.updateInitiative = updateInitiative;
window.updateTask = updateTask;
window.updateTaskProgress = updateTaskProgress;
window.showAddResourceForm = showAddResourceForm;
window.saveResource = saveResource;
window.editResource = editResource;
window.updateResource = updateResource;
window.loadCommonResources = loadCommonResources;
window.deleteResource = deleteResource;
window.closeModal = closeModal;
window.loadExamplePlan = loadExamplePlan;
window.clearAll = clearAll;
window.switchView = switchView;
window.scheduleProject = scheduleProject;
