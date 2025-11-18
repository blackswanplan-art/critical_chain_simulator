// Critical Chain Simulator - Interactive Canvas Application
// Data structures based on VBA implementation

class Resource {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.tasks = [];
    }

    toString() {
        return `Resource ${String.fromCharCode(64 + this.id)}: ${this.name}`;
    }
}

class Task {
    constructor(id, title, duration, resourceId, predecessors = []) {
        this.id = id;
        this.title = title;
        this.nominalDuration = duration;
        this.duration = Math.ceil(duration / 2); // CCPM: use 50% of nominal duration
        this.resourceId = resourceId;
        this.predecessors = predecessors;
        this.start = 0;
        this.end = 0;
        this.type = 0; // 0: regular, 1: critical chain, 2: buffer
        this.isCriticalChain = false;
    }

    toString() {
        return `Task ${this.id}: ${this.title}`;
    }
}

// Global state
let resources = [];
let tasks = [];
let canvas, ctx;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let selectedTask = null;
let draggedTask = null;
let isDragging = false;
let dragStartX = 0;
let criticalChain = [];

// Constants
const COLORS = {
    regular: '#4CAF50',
    critical: '#FF5722',
    buffer: '#FFC107',
    selected: '#2196F3',
    grid: '#E0E0E0',
    text: '#333333',
    taskBorder: '#FFFFFF'
};

const CANVAS_CONFIG = {
    rowHeight: 40,
    dayWidth: 30,
    leftMargin: 200,
    topMargin: 80,
    taskHeight: 30,
    fontSize: 12,
    bufferOpacity: 0.6
};

// Initialize application
window.addEventListener('load', () => {
    canvas = document.getElementById('ganttCanvas');
    ctx = canvas.getContext('2d');

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleCanvasClick);

    // Initial render
    render();
    updateUI();
});

function resizeCanvas() {
    const wrapper = canvas.parentElement;
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    render();
}

// Resource management
function addResource() {
    const nameInput = document.getElementById('resourceName');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Please enter a resource name');
        return;
    }

    const resource = new Resource(resources.length + 1, name);
    resources.push(resource);

    nameInput.value = '';
    updateResourceList();
    updateUI();
    render();
}

function removeResource(id) {
    // Check if resource is used by any task
    const usedByTask = tasks.find(t => t.resourceId === id);
    if (usedByTask) {
        alert('Cannot remove resource: it is assigned to one or more tasks');
        return;
    }

    resources = resources.filter(r => r.id !== id);
    // Reassign IDs
    resources.forEach((r, idx) => r.id = idx + 1);

    updateResourceList();
    updateUI();
    render();
}

function updateResourceList() {
    const list = document.getElementById('resourceList');
    const select = document.getElementById('taskResource');

    list.innerHTML = '';
    select.innerHTML = '<option value="">Select resource</option>';

    resources.forEach(resource => {
        // List item
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <span>${String.fromCharCode(64 + resource.id)} - ${resource.name}</span>
            <button onclick="removeResource(${resource.id})" class="btn-remove">×</button>
        `;
        list.appendChild(item);

        // Select option
        const option = document.createElement('option');
        option.value = resource.id;
        option.textContent = `${String.fromCharCode(64 + resource.id)} - ${resource.name}`;
        select.appendChild(option);
    });
}

// Task management
function addTask() {
    const nameInput = document.getElementById('taskName');
    const durationInput = document.getElementById('taskDuration');
    const resourceSelect = document.getElementById('taskResource');
    const predsInput = document.getElementById('taskPredecessors');

    const name = nameInput.value.trim();
    const duration = parseInt(durationInput.value);
    const resourceId = parseInt(resourceSelect.value);
    const predsStr = predsInput.value.trim();

    if (!name) {
        alert('Please enter a task name');
        return;
    }

    if (!duration || duration < 1) {
        alert('Please enter a valid duration');
        return;
    }

    // Parse predecessors
    const predecessors = predsStr ?
        predsStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0) :
        [];

    // Validate predecessors
    for (let predId of predecessors) {
        if (!tasks.find(t => t.id === predId)) {
            alert(`Invalid predecessor: Task ${predId} does not exist`);
            return;
        }
    }

    const task = new Task(tasks.length + 1, name, duration, resourceId, predecessors);
    tasks.push(task);

    // Clear inputs
    nameInput.value = '';
    durationInput.value = '5';
    resourceSelect.value = '';
    predsInput.value = '';

    updateTaskList();
    calculateSchedule();
    updateUI();
    render();
}

function removeTask(id) {
    // Check if task is predecessor to another task
    const dependentTask = tasks.find(t => t.predecessors.includes(id));
    if (dependentTask) {
        alert(`Cannot remove task: Task ${dependentTask.id} depends on it`);
        return;
    }

    tasks = tasks.filter(t => t.id !== id);
    // Reassign IDs and update predecessors
    const oldToNew = {};
    tasks.forEach((t, idx) => {
        oldToNew[t.id] = idx + 1;
        t.id = idx + 1;
    });
    tasks.forEach(t => {
        t.predecessors = t.predecessors.map(p => oldToNew[p] || p);
    });

    updateTaskList();
    calculateSchedule();
    updateUI();
    render();
}

function updateTaskList() {
    const list = document.getElementById('taskList');
    list.innerHTML = '';

    tasks.forEach(task => {
        const resource = resources.find(r => r.id === task.resourceId);
        const resourceName = resource ? resource.name : 'Unassigned';
        const predsStr = task.predecessors.length > 0 ? task.predecessors.join(', ') : 'None';

        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="task-item-content">
                <strong>${task.id}. ${task.title}</strong>
                <small>Duration: ${task.duration}d (${task.nominalDuration}d nominal) | Resource: ${resourceName}</small>
                <small>Predecessors: ${predsStr}</small>
            </div>
            <button onclick="removeTask(${task.id})" class="btn-remove">×</button>
        `;
        list.appendChild(item);
    });
}

// Scheduling algorithm (Critical Chain Method)
function calculateSchedule() {
    if (tasks.length === 0) {
        updateUI();
        render();
        return;
    }

    // Reset all tasks
    tasks.forEach(task => {
        task.start = 0;
        task.end = 0;
        task.isCriticalChain = false;
    });

    // Forward pass: calculate earliest start and end times
    let changed = true;
    while (changed) {
        changed = false;
        tasks.forEach(task => {
            let earliestStart = 0;

            // Check predecessors
            if (task.predecessors.length > 0) {
                task.predecessors.forEach(predId => {
                    const pred = tasks.find(t => t.id === predId);
                    if (pred && pred.end > earliestStart) {
                        earliestStart = pred.end;
                    }
                });
            }

            // Check resource conflicts
            if (task.resourceId) {
                const resourceTasks = tasks.filter(t =>
                    t.resourceId === task.resourceId &&
                    t.id !== task.id &&
                    t.end > 0
                );

                resourceTasks.forEach(rt => {
                    if (rt.start < earliestStart + task.duration && rt.end > earliestStart) {
                        if (rt.end > earliestStart) {
                            earliestStart = rt.end;
                        }
                    }
                });
            }

            const newStart = earliestStart;
            const newEnd = earliestStart + task.duration;

            if (task.start !== newStart || task.end !== newEnd) {
                task.start = newStart;
                task.end = newEnd;
                changed = true;
            }
        });
    }

    // Identify critical chain (longest chain of dependent tasks)
    identifyCriticalChain();

    updateUI();
    render();
}

function identifyCriticalChain() {
    criticalChain = [];

    if (tasks.length === 0) return;

    // Find the task that ends last
    let lastTask = tasks.reduce((max, task) => task.end > max.end ? task : max, tasks[0]);

    // Trace back through predecessors
    let current = lastTask;
    const chain = [];

    while (current) {
        chain.unshift(current.id);
        current.isCriticalChain = true;

        // Find predecessor that ends latest
        if (current.predecessors.length > 0) {
            let latestPred = null;
            let latestEnd = -1;

            current.predecessors.forEach(predId => {
                const pred = tasks.find(t => t.id === predId);
                if (pred && pred.end > latestEnd) {
                    latestEnd = pred.end;
                    latestPred = pred;
                }
            });

            current = latestPred;
        } else {
            current = null;
        }
    }

    criticalChain = chain;
}

// Canvas rendering
function render() {
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (tasks.length === 0) {
        drawEmptyState();
        return;
    }

    // Calculate project duration
    const maxEnd = Math.max(...tasks.map(t => t.end), 0);
    const projectDuration = maxEnd + 10; // Add some padding

    // Draw grid
    drawGrid(projectDuration);

    // Draw tasks
    drawTasks();

    // Draw dependencies
    drawDependencies();

    // Draw buffers if enabled
    if (document.getElementById('showBuffers').checked) {
        drawBuffers();
    }
}

function drawEmptyState() {
    ctx.fillStyle = COLORS.text;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Add resources and tasks to begin', canvas.width / 2, canvas.height / 2);
    ctx.font = '12px Arial';
    ctx.fillText('Use the control panel on the left to create your project', canvas.width / 2, canvas.height / 2 + 25);
}

function drawGrid(projectDuration) {
    const config = CANVAS_CONFIG;

    // Draw timeline header
    ctx.fillStyle = '#37474F';
    ctx.fillRect(0, 0, canvas.width, config.topMargin - 10);

    // Draw day markers
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.font = `${config.fontSize}px Arial`;
    ctx.textAlign = 'center';

    for (let day = 0; day <= projectDuration; day++) {
        const x = config.leftMargin + day * config.dayWidth * scale;

        // Vertical grid line
        ctx.beginPath();
        ctx.moveTo(x, config.topMargin);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();

        // Day label
        if (day % 5 === 0 || day === projectDuration) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(`Day ${day}`, x, config.topMargin - 20);
        }
    }

    // Draw task rows
    tasks.forEach((task, idx) => {
        const y = config.topMargin + idx * config.rowHeight;

        // Row background
        ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
        ctx.fillRect(0, y, canvas.width, config.rowHeight);

        // Task label
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'left';
        ctx.font = `${config.fontSize}px Arial`;
        const resource = resources.find(r => r.id === task.resourceId);
        const resourceLabel = resource ? String.fromCharCode(64 + resource.id) : '';
        ctx.fillText(`${task.id}. ${task.title} [${resourceLabel}]`, 10, y + config.rowHeight / 2 + 4);
    });
}

function drawTasks() {
    const config = CANVAS_CONFIG;
    const showCriticalChain = document.getElementById('showCriticalChain').checked;

    tasks.forEach((task, idx) => {
        const y = config.topMargin + idx * config.rowHeight + (config.rowHeight - config.taskHeight) / 2;
        const x = config.leftMargin + task.start * config.dayWidth * scale;
        const width = task.duration * config.dayWidth * scale;

        // Determine color
        let color = COLORS.regular;
        if (selectedTask && selectedTask.id === task.id) {
            color = COLORS.selected;
        } else if (showCriticalChain && task.isCriticalChain) {
            color = COLORS.critical;
        }

        // Draw task bar
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, config.taskHeight);

        // Draw border
        ctx.strokeStyle = COLORS.taskBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, config.taskHeight);

        // Draw task duration text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${config.fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`${task.duration}d`, x + width / 2, y + config.taskHeight / 2 + 4);
    });
}

function drawDependencies() {
    const config = CANVAS_CONFIG;

    ctx.strokeStyle = '#757575';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    tasks.forEach((task, idx) => {
        task.predecessors.forEach(predId => {
            const pred = tasks.find(t => t.id === predId);
            if (!pred) return;

            const predIdx = tasks.indexOf(pred);

            const x1 = config.leftMargin + pred.end * config.dayWidth * scale;
            const y1 = config.topMargin + predIdx * config.rowHeight + config.rowHeight / 2;

            const x2 = config.leftMargin + task.start * config.dayWidth * scale;
            const y2 = config.topMargin + idx * config.rowHeight + config.rowHeight / 2;

            // Draw arrow
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Draw arrowhead
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const arrowLength = 10;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - arrowLength * Math.cos(angle - Math.PI / 6),
                      y2 - arrowLength * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - arrowLength * Math.cos(angle + Math.PI / 6),
                      y2 - arrowLength * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        });
    });

    ctx.setLineDash([]);
}

function drawBuffers() {
    const config = CANVAS_CONFIG;

    criticalChain.forEach(taskId => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const bufferSize = Math.ceil((task.nominalDuration - task.duration) / 2);
        const idx = tasks.indexOf(task);
        const y = config.topMargin + idx * config.rowHeight + (config.rowHeight - config.taskHeight) / 2;
        const x = config.leftMargin + task.end * config.dayWidth * scale;
        const width = bufferSize * config.dayWidth * scale;

        // Draw buffer
        ctx.globalAlpha = config.bufferOpacity;
        ctx.fillStyle = COLORS.buffer;
        ctx.fillRect(x, y, width, config.taskHeight);
        ctx.globalAlpha = 1.0;

        // Draw buffer label
        ctx.fillStyle = COLORS.text;
        ctx.font = `${config.fontSize - 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`B:${bufferSize}d`, x + width / 2, y + config.taskHeight / 2 + 4);
    });
}

// Mouse interaction
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const task = getTaskAtPosition(x, y);
    if (task) {
        draggedTask = task;
        isDragging = true;
        dragStartX = x;
        selectedTask = task;
        render();
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update cursor
    const task = getTaskAtPosition(x, y);
    canvas.style.cursor = task ? 'pointer' : 'default';

    if (isDragging && draggedTask) {
        const config = CANVAS_CONFIG;
        const dx = x - dragStartX;
        const daysDelta = Math.round(dx / (config.dayWidth * scale));

        // Show visual feedback (not implemented in this version)
        // In full implementation, would show ghost task while dragging
    }
}

function handleMouseUp(e) {
    if (isDragging && draggedTask) {
        // In full implementation, would update task start time
        // For now, we just deselect
        isDragging = false;
        draggedTask = null;
    }
}

function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const task = getTaskAtPosition(x, y);
    if (task) {
        showTaskDetails(task);
    }
}

function getTaskAtPosition(x, y) {
    const config = CANVAS_CONFIG;

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const taskY = config.topMargin + i * config.rowHeight + (config.rowHeight - config.taskHeight) / 2;
        const taskX = config.leftMargin + task.start * config.dayWidth * scale;
        const taskWidth = task.duration * config.dayWidth * scale;

        if (x >= taskX && x <= taskX + taskWidth && y >= taskY && y <= taskY + config.taskHeight) {
            return task;
        }
    }

    return null;
}

function showTaskDetails(task) {
    const modal = document.getElementById('taskModal');
    const details = document.getElementById('taskDetails');

    const resource = resources.find(r => r.id === task.resourceId);
    const resourceName = resource ? resource.name : 'Unassigned';
    const predsStr = task.predecessors.length > 0 ? task.predecessors.join(', ') : 'None';

    details.innerHTML = `
        <p><strong>ID:</strong> ${task.id}</p>
        <p><strong>Title:</strong> ${task.title}</p>
        <p><strong>Nominal Duration:</strong> ${task.nominalDuration} days</p>
        <p><strong>Planned Duration (50%):</strong> ${task.duration} days</p>
        <p><strong>Resource:</strong> ${resourceName}</p>
        <p><strong>Predecessors:</strong> ${predsStr}</p>
        <p><strong>Start Day:</strong> ${task.start}</p>
        <p><strong>End Day:</strong> ${task.end}</p>
        <p><strong>Critical Chain:</strong> ${task.isCriticalChain ? 'Yes' : 'No'}</p>
    `;

    modal.style.display = 'block';
}

function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
}

// UI updates
function updateUI() {
    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('totalResources').textContent = resources.length;

    const maxEnd = tasks.length > 0 ? Math.max(...tasks.map(t => t.end)) : 0;
    document.getElementById('projectDuration').textContent = maxEnd;
    document.getElementById('criticalChainLength').textContent = criticalChain.length;
}

// Zoom controls
function zoomIn() {
    scale *= 1.2;
    render();
}

function zoomOut() {
    scale /= 1.2;
    render();
}

function resetZoom() {
    scale = 1;
    render();
}

// Utility functions
function clearAll() {
    if (!confirm('Are you sure you want to clear all tasks and resources?')) {
        return;
    }

    tasks = [];
    resources = [];
    criticalChain = [];
    selectedTask = null;

    updateResourceList();
    updateTaskList();
    updateUI();
    render();
}

function loadExample() {
    // Clear existing data
    tasks = [];
    resources = [];

    // Add example resources
    resources.push(new Resource(1, 'Developer Team'));
    resources.push(new Resource(2, 'Designer'));
    resources.push(new Resource(3, 'QA Team'));
    resources.push(new Resource(4, 'DevOps'));

    // Add example tasks
    tasks.push(new Task(1, 'Requirements Analysis', 10, 1, []));
    tasks.push(new Task(2, 'UI/UX Design', 8, 2, [1]));
    tasks.push(new Task(3, 'Backend Development', 20, 1, [1]));
    tasks.push(new Task(4, 'Frontend Development', 16, 1, [2]));
    tasks.push(new Task(5, 'API Integration', 12, 1, [3, 4]));
    tasks.push(new Task(6, 'Testing', 10, 3, [5]));
    tasks.push(new Task(7, 'Deployment Setup', 6, 4, [6]));
    tasks.push(new Task(8, 'Final Review', 4, 1, [7]));

    updateResourceList();
    updateTaskList();
    calculateSchedule();
    updateUI();
    render();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('taskModal');
    if (event.target === modal) {
        closeTaskModal();
    }
}
