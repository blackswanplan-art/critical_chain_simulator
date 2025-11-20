// Critical Chain Simulator - Enhanced Interactive Canvas Application
// Version 2.0 with Progress Tracking, Fever Chart, Save/Load, and Enhanced Drag-Drop

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

        // NEW: Progress tracking
        this.progress = 0; // 0-100%
        this.actualStart = null;
        this.actualEnd = null;
        this.status = 'not_started'; // not_started, in_progress, completed
    }

    toString() {
        return `Task ${this.id}: ${this.title}`;
    }
}

// Project state
class ProjectState {
    constructor() {
        this.resources = [];
        this.tasks = [];
        this.projectName = 'Untitled Project';
        this.currentDay = 0; // For progress tracking
        this.createdDate = new Date().toISOString();
        this.modifiedDate = new Date().toISOString();
    }

    toJSON() {
        return {
            projectName: this.projectName,
            currentDay: this.currentDay,
            resources: this.resources,
            tasks: this.tasks,
            createdDate: this.createdDate,
            modifiedDate: new Date().toISOString()
        };
    }

    fromJSON(data) {
        this.projectName = data.projectName || 'Untitled Project';
        this.currentDay = data.currentDay || 0;
        this.createdDate = data.createdDate;
        this.modifiedDate = data.modifiedDate;

        // Restore resources
        this.resources = data.resources.map(r => {
            const resource = new Resource(r.id, r.name);
            resource.tasks = r.tasks || [];
            return resource;
        });

        // Restore tasks
        this.tasks = data.tasks.map(t => {
            const task = new Task(t.id, t.title, t.nominalDuration, t.resourceId, t.predecessors);
            task.duration = t.duration;
            task.start = t.start;
            task.end = t.end;
            task.isCriticalChain = t.isCriticalChain;
            task.progress = t.progress || 0;
            task.actualStart = t.actualStart;
            task.actualEnd = t.actualEnd;
            task.status = t.status || 'not_started';
            return task;
        });
    }
}

// Global state
let projectState = new ProjectState();
let canvas, ctx;
let feverCanvas, feverCtx;
let scale = 1;
let selectedTask = null;
let draggedTask = null;
let isDragging = false;
let dragStartX = 0;
let dragStartDay = 0;
let criticalChain = [];
let bufferHistory = []; // For fever chart
let autoSaveInterval = null;

// Constants
const COLORS = {
    regular: '#4CAF50',
    critical: '#FF5722',
    buffer: '#FFC107',
    selected: '#2196F3',
    completed: '#9C27B0',
    inProgress: '#03A9F4',
    grid: '#E0E0E0',
    text: '#333333',
    taskBorder: '#FFFFFF',
    progress: 'rgba(255, 255, 255, 0.3)',
    feverGreen: '#4CAF50',
    feverYellow: '#FFC107',
    feverRed: '#F44336'
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

    feverCanvas = document.getElementById('feverCanvas');
    if (feverCanvas) {
        feverCtx = feverCanvas.getContext('2d');
    }

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleCanvasClick);

    // Load saved project or start fresh
    loadFromLocalStorage();

    // Start auto-save
    startAutoSave();

    // Initial render
    render();
    updateUI();
});

function resizeCanvas() {
    const wrapper = canvas.parentElement;
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    render();

    if (feverCanvas) {
        const feverWrapper = feverCanvas.parentElement;
        feverCanvas.width = feverWrapper.clientWidth;
        feverCanvas.height = feverWrapper.clientHeight;
        drawFeverChart();
    }
}

// ===== PERSISTENCE =====

function saveToLocalStorage() {
    try {
        const data = projectState.toJSON();
        localStorage.setItem('ccpm_project', JSON.stringify(data));
        console.log('Project auto-saved');
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('ccpm_project');
        if (saved) {
            const data = JSON.parse(saved);
            projectState.fromJSON(data);
            updateResourceList();
            updateTaskList();
            calculateSchedule();
            updateUI();
            render();
            console.log('Project loaded from localStorage');
        }
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
    }
}

function startAutoSave() {
    // Auto-save every 10 seconds
    autoSaveInterval = setInterval(() => {
        saveToLocalStorage();
    }, 10000);
}

function exportToJSON() {
    const data = projectState.toJSON();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectState.projectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
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
                projectState.fromJSON(data);
                updateResourceList();
                updateTaskList();
                calculateSchedule();
                updateUI();
                render();
                saveToLocalStorage();
                alert('Project imported successfully!');
            } catch (err) {
                alert('Failed to import project: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ===== RESOURCE MANAGEMENT =====

function addResource() {
    const nameInput = document.getElementById('resourceName');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Please enter a resource name');
        return;
    }

    const resource = new Resource(projectState.resources.length + 1, name);
    projectState.resources.push(resource);

    nameInput.value = '';
    updateResourceList();
    updateUI();
    render();
    saveToLocalStorage();
}

function removeResource(id) {
    const usedByTask = projectState.tasks.find(t => t.resourceId === id);
    if (usedByTask) {
        alert('Cannot remove resource: it is assigned to one or more tasks');
        return;
    }

    projectState.resources = projectState.resources.filter(r => r.id !== id);
    projectState.resources.forEach((r, idx) => r.id = idx + 1);

    updateResourceList();
    updateUI();
    render();
    saveToLocalStorage();
}

function updateResourceList() {
    const list = document.getElementById('resourceList');
    const select = document.getElementById('taskResource');

    list.innerHTML = '';
    select.innerHTML = '<option value="">Select resource</option>';

    projectState.resources.forEach(resource => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <span>${String.fromCharCode(64 + resource.id)} - ${resource.name}</span>
            <button onclick="removeResource(${resource.id})" class="btn-remove">×</button>
        `;
        list.appendChild(item);

        const option = document.createElement('option');
        option.value = resource.id;
        option.textContent = `${String.fromCharCode(64 + resource.id)} - ${resource.name}`;
        select.appendChild(option);
    });
}

// ===== TASK MANAGEMENT =====

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

    const predecessors = predsStr ?
        predsStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0) :
        [];

    for (let predId of predecessors) {
        if (!projectState.tasks.find(t => t.id === predId)) {
            alert(`Invalid predecessor: Task ${predId} does not exist`);
            return;
        }
    }

    const task = new Task(projectState.tasks.length + 1, name, duration, resourceId, predecessors);
    projectState.tasks.push(task);

    nameInput.value = '';
    durationInput.value = '5';
    resourceSelect.value = '';
    predsInput.value = '';

    updateTaskList();
    calculateSchedule();
    updateUI();
    render();
    saveToLocalStorage();
}

function removeTask(id) {
    const dependentTask = projectState.tasks.find(t => t.predecessors.includes(id));
    if (dependentTask) {
        alert(`Cannot remove task: Task ${dependentTask.id} depends on it`);
        return;
    }

    projectState.tasks = projectState.tasks.filter(t => t.id !== id);
    const oldToNew = {};
    projectState.tasks.forEach((t, idx) => {
        oldToNew[t.id] = idx + 1;
        t.id = idx + 1;
    });
    projectState.tasks.forEach(t => {
        t.predecessors = t.predecessors.map(p => oldToNew[p] || p);
    });

    updateTaskList();
    calculateSchedule();
    updateUI();
    render();
    saveToLocalStorage();
}

function updateTaskProgress(taskId, progress) {
    const task = projectState.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.progress = Math.max(0, Math.min(100, progress));

    if (task.progress > 0 && task.status === 'not_started') {
        task.status = 'in_progress';
        task.actualStart = projectState.currentDay;
    }

    if (task.progress === 100 && task.status !== 'completed') {
        task.status = 'completed';
        task.actualEnd = projectState.currentDay;
    }

    updateTaskList();
    updateBufferHistory();
    render();
    drawFeverChart();
    saveToLocalStorage();
}

function updateTaskList() {
    const list = document.getElementById('taskList');
    list.innerHTML = '';

    projectState.tasks.forEach(task => {
        const resource = projectState.resources.find(r => r.id === task.resourceId);
        const resourceName = resource ? resource.name : 'Unassigned';
        const predsStr = task.predecessors.length > 0 ? task.predecessors.join(', ') : 'None';

        const item = document.createElement('div');
        item.className = 'list-item task-list-item';
        item.innerHTML = `
            <div class="task-item-content">
                <strong>${task.id}. ${task.title}</strong>
                <small>Duration: ${task.duration}d (${task.nominalDuration}d nominal) | Resource: ${resourceName}</small>
                <small>Predecessors: ${predsStr} | Status: ${task.status.replace('_', ' ')}</small>
                <div class="progress-control">
                    <label>Progress: ${task.progress}%</label>
                    <input type="range" min="0" max="100" value="${task.progress}"
                           onchange="updateTaskProgress(${task.id}, this.value)"
                           oninput="this.previousElementSibling.textContent = 'Progress: ' + this.value + '%'">
                </div>
            </div>
            <button onclick="removeTask(${task.id})" class="btn-remove">×</button>
        `;
        list.appendChild(item);
    });
}

// ===== SCHEDULING ALGORITHM =====

function calculateSchedule() {
    if (projectState.tasks.length === 0) {
        updateUI();
        render();
        return;
    }

    projectState.tasks.forEach(task => {
        task.start = 0;
        task.end = 0;
        task.isCriticalChain = false;
    });

    let changed = true;
    while (changed) {
        changed = false;
        projectState.tasks.forEach(task => {
            let earliestStart = 0;

            if (task.predecessors.length > 0) {
                task.predecessors.forEach(predId => {
                    const pred = projectState.tasks.find(t => t.id === predId);
                    if (pred && pred.end > earliestStart) {
                        earliestStart = pred.end;
                    }
                });
            }

            if (task.resourceId) {
                const resourceTasks = projectState.tasks.filter(t =>
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

    identifyCriticalChain();
    updateBufferHistory();
    updateUI();
    render();
}

function identifyCriticalChain() {
    criticalChain = [];

    if (projectState.tasks.length === 0) return;

    let lastTask = projectState.tasks.reduce((max, task) => task.end > max.end ? task : max, projectState.tasks[0]);

    let current = lastTask;
    const chain = [];

    while (current) {
        chain.unshift(current.id);
        current.isCriticalChain = true;

        if (current.predecessors.length > 0) {
            let latestPred = null;
            let latestEnd = -1;

            current.predecessors.forEach(predId => {
                const pred = projectState.tasks.find(t => t.id === predId);
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

// ===== BUFFER TRACKING & FEVER CHART =====

function updateBufferHistory() {
    // Calculate total buffer consumption for fever chart
    let totalBufferPlanned = 0;
    let totalBufferConsumed = 0;

    criticalChain.forEach(taskId => {
        const task = projectState.tasks.find(t => t.id === taskId);
        if (!task) return;

        const bufferSize = Math.ceil((task.nominalDuration - task.duration) / 2);
        totalBufferPlanned += bufferSize;

        if (task.status === 'completed' && task.actualEnd) {
            const actualDuration = task.actualEnd - task.actualStart;
            const bufferUsed = Math.max(0, actualDuration - task.duration);
            totalBufferConsumed += bufferUsed;
        }
    });

    const entry = {
        day: projectState.currentDay,
        plannedBuffer: totalBufferPlanned,
        consumedBuffer: totalBufferConsumed,
        consumptionRate: totalBufferPlanned > 0 ? (totalBufferConsumed / totalBufferPlanned) * 100 : 0
    };

    // Only add if currentDay changed or first entry
    if (bufferHistory.length === 0 || bufferHistory[bufferHistory.length - 1].day !== projectState.currentDay) {
        bufferHistory.push(entry);
        if (bufferHistory.length > 100) { // Keep last 100 entries
            bufferHistory.shift();
        }
    }
}

function drawFeverChart() {
    if (!feverCtx || bufferHistory.length < 2) return;

    const width = feverCanvas.width;
    const height = feverCanvas.height;
    const padding = 40;

    // Clear
    feverCtx.clearRect(0, 0, width, height);
    feverCtx.fillStyle = '#FFFFFF';
    feverCtx.fillRect(0, 0, width, height);

    // Draw zones
    const zoneHeight = (height - padding * 2) / 3;

    // Red zone (>66%)
    feverCtx.fillStyle = 'rgba(244, 67, 54, 0.1)';
    feverCtx.fillRect(padding, padding, width - padding * 2, zoneHeight);

    // Yellow zone (33-66%)
    feverCtx.fillStyle = 'rgba(255, 193, 7, 0.1)';
    feverCtx.fillRect(padding, padding + zoneHeight, width - padding * 2, zoneHeight);

    // Green zone (<33%)
    feverCtx.fillStyle = 'rgba(76, 175, 80, 0.1)';
    feverCtx.fillRect(padding, padding + zoneHeight * 2, width - padding * 2, zoneHeight);

    // Draw axes
    feverCtx.strokeStyle = '#000';
    feverCtx.lineWidth = 2;
    feverCtx.beginPath();
    feverCtx.moveTo(padding, padding);
    feverCtx.lineTo(padding, height - padding);
    feverCtx.lineTo(width - padding, height - padding);
    feverCtx.stroke();

    // Labels
    feverCtx.fillStyle = '#000';
    feverCtx.font = '12px Arial';
    feverCtx.textAlign = 'right';
    feverCtx.fillText('100%', padding - 5, padding + 5);
    feverCtx.fillText('66%', padding - 5, padding + zoneHeight + 5);
    feverCtx.fillText('33%', padding - 5, padding + zoneHeight * 2 + 5);
    feverCtx.fillText('0%', padding - 5, height - padding + 5);

    feverCtx.textAlign = 'center';
    feverCtx.fillText('Day', width / 2, height - 10);

    feverCtx.save();
    feverCtx.translate(15, height / 2);
    feverCtx.rotate(-Math.PI / 2);
    feverCtx.fillText('Buffer Consumption %', 0, 0);
    feverCtx.restore();

    // Draw data line
    if (bufferHistory.length > 1) {
        const maxDay = Math.max(...bufferHistory.map(h => h.day), projectState.currentDay);
        const xScale = (width - padding * 2) / Math.max(maxDay, 1);
        const yScale = (height - padding * 2) / 100;

        feverCtx.strokeStyle = '#2196F3';
        feverCtx.lineWidth = 3;
        feverCtx.beginPath();

        bufferHistory.forEach((entry, idx) => {
            const x = padding + entry.day * xScale;
            const y = height - padding - entry.consumptionRate * yScale;

            if (idx === 0) {
                feverCtx.moveTo(x, y);
            } else {
                feverCtx.lineTo(x, y);
            }
        });

        feverCtx.stroke();

        // Draw points
        bufferHistory.forEach(entry => {
            const x = padding + entry.day * xScale;
            const y = height - padding - entry.consumptionRate * yScale;

            feverCtx.fillStyle = '#2196F3';
            feverCtx.beginPath();
            feverCtx.arc(x, y, 4, 0, Math.PI * 2);
            feverCtx.fill();
        });
    }
}

// ===== CANVAS RENDERING =====

function render() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (projectState.tasks.length === 0) {
        drawEmptyState();
        return;
    }

    const maxEnd = Math.max(...projectState.tasks.map(t => t.end), 0);
    const projectDuration = Math.max(maxEnd + 10, projectState.currentDay + 5);

    drawGrid(projectDuration);
    drawTasks();
    drawDependencies();

    if (document.getElementById('showBuffers').checked) {
        drawBuffers();
    }

    // Draw current day marker
    drawCurrentDayMarker();
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

    ctx.fillStyle = '#37474F';
    ctx.fillRect(0, 0, canvas.width, config.topMargin - 10);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.font = `${config.fontSize}px Arial`;
    ctx.textAlign = 'center';

    for (let day = 0; day <= projectDuration; day++) {
        const x = config.leftMargin + day * config.dayWidth * scale;

        ctx.beginPath();
        ctx.moveTo(x, config.topMargin);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();

        if (day % 5 === 0 || day === projectDuration) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(`Day ${day}`, x, config.topMargin - 20);
        }
    }

    projectState.tasks.forEach((task, idx) => {
        const y = config.topMargin + idx * config.rowHeight;

        ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
        ctx.fillRect(0, y, canvas.width, config.rowHeight);

        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'left';
        ctx.font = `${config.fontSize}px Arial`;
        const resource = projectState.resources.find(r => r.id === task.resourceId);
        const resourceLabel = resource ? String.fromCharCode(64 + resource.id) : '';
        const statusIcon = task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '▶' : '○';
        ctx.fillText(`${statusIcon} ${task.id}. ${task.title} [${resourceLabel}]`, 10, y + config.rowHeight / 2 + 4);
    });
}

function drawTasks() {
    const config = CANVAS_CONFIG;
    const showCriticalChain = document.getElementById('showCriticalChain').checked;

    projectState.tasks.forEach((task, idx) => {
        const y = config.topMargin + idx * config.rowHeight + (config.rowHeight - config.taskHeight) / 2;
        const x = config.leftMargin + task.start * config.dayWidth * scale;
        const width = task.duration * config.dayWidth * scale;

        // Determine color based on status and critical chain
        let color = COLORS.regular;
        if (task.status === 'completed') {
            color = COLORS.completed;
        } else if (task.status === 'in_progress') {
            color = COLORS.inProgress;
        } else if (selectedTask && selectedTask.id === task.id) {
            color = COLORS.selected;
        } else if (showCriticalChain && task.isCriticalChain) {
            color = COLORS.critical;
        }

        // Draw task bar
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, config.taskHeight);

        // Draw progress bar
        if (task.progress > 0) {
            const progressWidth = (width * task.progress) / 100;
            ctx.fillStyle = COLORS.progress;
            ctx.fillRect(x, y, progressWidth, config.taskHeight);
        }

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

    projectState.tasks.forEach((task, idx) => {
        task.predecessors.forEach(predId => {
            const pred = projectState.tasks.find(t => t.id === predId);
            if (!pred) return;

            const predIdx = projectState.tasks.indexOf(pred);

            const x1 = config.leftMargin + pred.end * config.dayWidth * scale;
            const y1 = config.topMargin + predIdx * config.rowHeight + config.rowHeight / 2;

            const x2 = config.leftMargin + task.start * config.dayWidth * scale;
            const y2 = config.topMargin + idx * config.rowHeight + config.rowHeight / 2;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

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
        const task = projectState.tasks.find(t => t.id === taskId);
        if (!task) return;

        const bufferSize = Math.ceil((task.nominalDuration - task.duration) / 2);
        const idx = projectState.tasks.indexOf(task);
        const y = config.topMargin + idx * config.rowHeight + (config.rowHeight - config.taskHeight) / 2;
        const x = config.leftMargin + task.end * config.dayWidth * scale;
        const width = bufferSize * config.dayWidth * scale;

        ctx.globalAlpha = config.bufferOpacity;
        ctx.fillStyle = COLORS.buffer;
        ctx.fillRect(x, y, width, config.taskHeight);
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = COLORS.text;
        ctx.font = `${config.fontSize - 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`B:${bufferSize}d`, x + width / 2, y + config.taskHeight / 2 + 4);
    });
}

function drawCurrentDayMarker() {
    if (projectState.currentDay === 0) return;

    const config = CANVAS_CONFIG;
    const x = config.leftMargin + projectState.currentDay * config.dayWidth * scale;

    ctx.strokeStyle = '#E91E63';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, config.topMargin);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();

    ctx.fillStyle = '#E91E63';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Today (Day ${projectState.currentDay})`, x, config.topMargin - 35);
}

// ===== MOUSE INTERACTION =====

function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const task = getTaskAtPosition(x, y);
    if (task) {
        draggedTask = task;
        isDragging = true;
        dragStartX = x;
        dragStartDay = task.start;
        selectedTask = task;
        canvas.style.cursor = 'grabbing';
        render();
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const task = getTaskAtPosition(x, y);

    if (!isDragging) {
        canvas.style.cursor = task ? 'grab' : 'default';
    }

    if (isDragging && draggedTask) {
        const config = CANVAS_CONFIG;
        const dx = x - dragStartX;
        const daysDelta = Math.round(dx / (config.dayWidth * scale));

        // Visual feedback during drag
        canvas.style.cursor = 'grabbing';
    }
}

function handleMouseUp(e) {
    if (isDragging && draggedTask) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;

        const config = CANVAS_CONFIG;
        const dx = x - dragStartX;
        const daysDelta = Math.round(dx / (config.dayWidth * scale));

        if (daysDelta !== 0) {
            // Manual task repositioning - remove automatic scheduling for this task
            const newStart = Math.max(0, dragStartDay + daysDelta);
            draggedTask.start = newStart;
            draggedTask.end = newStart + draggedTask.duration;

            // Recalculate dependent tasks
            calculateSchedule();
            saveToLocalStorage();
        }

        isDragging = false;
        draggedTask = null;
        canvas.style.cursor = 'default';
        render();
    }
}

function handleCanvasClick(e) {
    if (isDragging) return; // Don't show modal if we were dragging

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

    for (let i = 0; i < projectState.tasks.length; i++) {
        const task = projectState.tasks[i];
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

    const resource = projectState.resources.find(r => r.id === task.resourceId);
    const resourceName = resource ? resource.name : 'Unassigned';
    const predsStr = task.predecessors.length > 0 ? task.predecessors.join(', ') : 'None';

    details.innerHTML = `
        <p><strong>ID:</strong> ${task.id}</p>
        <p><strong>Title:</strong> ${task.title}</p>
        <p><strong>Status:</strong> ${task.status.replace('_', ' ')}</p>
        <p><strong>Progress:</strong> ${task.progress}%</p>
        <p><strong>Nominal Duration:</strong> ${task.nominalDuration} days</p>
        <p><strong>Planned Duration (50%):</strong> ${task.duration} days</p>
        <p><strong>Resource:</strong> ${resourceName}</p>
        <p><strong>Predecessors:</strong> ${predsStr}</p>
        <p><strong>Planned Start:</strong> Day ${task.start}</p>
        <p><strong>Planned End:</strong> Day ${task.end}</p>
        ${task.actualStart ? `<p><strong>Actual Start:</strong> Day ${task.actualStart}</p>` : ''}
        ${task.actualEnd ? `<p><strong>Actual End:</strong> Day ${task.actualEnd}</p>` : ''}
        <p><strong>Critical Chain:</strong> ${task.isCriticalChain ? 'Yes' : 'No'}</p>
    `;

    modal.style.display = 'block';
}

function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
}

// ===== UI UPDATES =====

function updateUI() {
    document.getElementById('totalTasks').textContent = projectState.tasks.length;
    document.getElementById('totalResources').textContent = projectState.resources.length;

    const maxEnd = projectState.tasks.length > 0 ? Math.max(...projectState.tasks.map(t => t.end)) : 0;
    document.getElementById('projectDuration').textContent = maxEnd;
    document.getElementById('criticalChainLength').textContent = criticalChain.length;

    if (document.getElementById('currentDay')) {
        document.getElementById('currentDay').textContent = projectState.currentDay;
    }

    if (document.getElementById('projectNameDisplay')) {
        document.getElementById('projectNameDisplay').textContent = projectState.projectName;
    }
}

function advanceDay() {
    projectState.currentDay++;
    updateBufferHistory();
    render();
    drawFeverChart();
    updateUI();
    saveToLocalStorage();
}

function setCurrentDay(day) {
    projectState.currentDay = Math.max(0, parseInt(day) || 0);
    updateBufferHistory();
    render();
    drawFeverChart();
    updateUI();
    saveToLocalStorage();
}

function setProjectName(name) {
    projectState.projectName = name || 'Untitled Project';
    updateUI();
    saveToLocalStorage();
}

// ===== ZOOM CONTROLS =====

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

// ===== UTILITY FUNCTIONS =====

function clearAll() {
    if (!confirm('Are you sure you want to clear all tasks and resources?')) {
        return;
    }

    projectState = new ProjectState();
    criticalChain = [];
    bufferHistory = [];
    selectedTask = null;

    updateResourceList();
    updateTaskList();
    updateUI();
    render();
    drawFeverChart();
    saveToLocalStorage();
}

function loadExample() {
    projectState.tasks = [];
    projectState.resources = [];
    projectState.projectName = 'Software Development Example';
    projectState.currentDay = 0;

    projectState.resources.push(new Resource(1, 'Developer Team'));
    projectState.resources.push(new Resource(2, 'Designer'));
    projectState.resources.push(new Resource(3, 'QA Team'));
    projectState.resources.push(new Resource(4, 'DevOps'));

    projectState.tasks.push(new Task(1, 'Requirements Analysis', 10, 1, []));
    projectState.tasks.push(new Task(2, 'UI/UX Design', 8, 2, [1]));
    projectState.tasks.push(new Task(3, 'Backend Development', 20, 1, [1]));
    projectState.tasks.push(new Task(4, 'Frontend Development', 16, 1, [2]));
    projectState.tasks.push(new Task(5, 'API Integration', 12, 1, [3, 4]));
    projectState.tasks.push(new Task(6, 'Testing', 10, 3, [5]));
    projectState.tasks.push(new Task(7, 'Deployment Setup', 6, 4, [6]));
    projectState.tasks.push(new Task(8, 'Final Review', 4, 1, [7]));

    updateResourceList();
    updateTaskList();
    calculateSchedule();
    updateUI();
    render();
    drawFeverChart();
    saveToLocalStorage();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('taskModal');
    if (event.target === modal) {
        closeTaskModal();
    }
}

// Make functions globally accessible
window.addResource = addResource;
window.removeResource = removeResource;
window.addTask = addTask;
window.removeTask = removeTask;
window.updateTaskProgress = updateTaskProgress;
window.calculateSchedule = calculateSchedule;
window.clearAll = clearAll;
window.loadExample = loadExample;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.closeTaskModal = closeTaskModal;
window.exportToJSON = exportToJSON;
window.importFromJSON = importFromJSON;
window.advanceDay = advanceDay;
window.setCurrentDay = setCurrentDay;
window.setProjectName = setProjectName;
