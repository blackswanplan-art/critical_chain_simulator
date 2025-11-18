# Interactive Canvas - Critical Chain Simulator

## Overview

The Interactive Canvas is a modern web-based interface for the Critical Chain Project Management Simulator. It provides a visual, interactive GANTT chart and project management tools built with HTML5 Canvas and JavaScript.

## Features

### Visual GANTT Chart
- **Interactive Canvas Rendering**: Real-time visualization of project timeline
- **Color-coded Tasks**:
  - Green: Regular tasks
  - Red: Critical chain tasks
  - Yellow: Buffers
  - Blue: Selected task
- **Dynamic Timeline**: Automatically scales based on project duration
- **Grid Layout**: Clear day markers and task rows

### Resource Management
- Create and manage project resources
- Assign resources to tasks
- Visual resource identification (A, B, C, etc.)
- Resource conflict detection and avoidance

### Task Management
- **Create Tasks** with:
  - Name/Title
  - Duration (nominal and planned)
  - Resource assignment
  - Task dependencies (predecessors)
- **Visual Task Properties**:
  - Task bars showing duration
  - Dependency arrows between tasks
  - Task labels with resource assignments
- **Interactive Task Details**: Click any task to view detailed information

### Critical Chain Methodology
- **Automatic Critical Chain Identification**: Highlights the longest chain of dependent tasks
- **Buffer Calculation**: Shows visual buffers based on CCPM principles
- **50% Duration Rule**: Tasks are automatically planned at 50% of nominal duration
- **Resource Conflict Resolution**: Automatically adjusts scheduling to avoid resource conflicts

### Interactive Features
- **Click to View Details**: Click any task to see full information
- **Visual Feedback**: Hover effects and selection highlighting
- **Zoom Controls**: Zoom in/out to view project at different scales
- **Dependency Visualization**: Dashed arrows show task dependencies

## Getting Started

### Quick Start

1. **Open the Application**:
   - Open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge)
   - No server required - runs entirely in the browser

2. **Load Example Project**:
   - Click "Load Example" button to see a sample software development project
   - Explore the GANTT chart, tasks, and resources

3. **Create Your Own Project**:
   - Start by adding resources
   - Add tasks with dependencies
   - Click "Calculate Schedule" to update the timeline

### Step-by-Step Usage

#### 1. Add Resources

Resources are people, teams, or equipment that perform tasks.

1. In the "Resources" section, enter a resource name
2. Click "Add Resource"
3. Resources are labeled A, B, C, etc.

**Example Resources**:
- Developer Team
- Designer
- QA Team
- DevOps

#### 2. Add Tasks

Tasks are the work items in your project.

1. In the "Tasks" section, fill in:
   - **Task Name**: Description of the work
   - **Days**: Nominal duration (the tool will use 50% for planning)
   - **Resource**: Who will do the work
   - **Predecessors**: Which tasks must complete first (comma-separated IDs)

2. Click "Add Task"

**Example Task**:
- Name: "Backend Development"
- Days: 20
- Resource: Developer Team (A)
- Predecessors: 1 (Requirements Analysis)

#### 3. View the Schedule

1. Click "Calculate Schedule" to update the GANTT chart
2. The system will:
   - Calculate earliest start times
   - Resolve resource conflicts
   - Identify the critical chain
   - Add buffers

#### 4. Interact with the Chart

- **View Task Details**: Click any task bar to see full information
- **Zoom**: Use +/- buttons to zoom in/out
- **Scroll**: Use mouse wheel or scrollbars to navigate large projects

#### 5. Customize View

Toggle options to show/hide:
- Critical Chain highlighting
- Buffer visualization
- Resource conflict warnings

## Understanding the Display

### Task Bars
- **Width**: Represents planned duration (50% of nominal)
- **Position**: Shows start time on timeline
- **Color**: Indicates task type (regular, critical, selected)
- **Label**: Shows planned duration in days

### Dependencies
- **Dashed Arrows**: Connect predecessor tasks to dependent tasks
- **Arrowhead**: Points to the dependent task
- Shows the logical flow of work

### Buffers
- **Semi-transparent Yellow Bars**: Appear after critical chain tasks
- **Size**: Calculated from the difference between nominal and planned duration
- **Purpose**: Protect the project schedule from delays

### Timeline
- **Day Markers**: Show project timeline in days
- **Major Markers**: Every 5 days labeled
- **Grid Lines**: Help align tasks to specific days

## Project Information Panel

Real-time statistics about your project:
- **Total Tasks**: Number of tasks in the project
- **Total Resources**: Number of resources available
- **Project Duration**: Total length in days
- **Critical Chain Length**: Number of tasks on the critical path

## Critical Chain Methodology

This tool implements Critical Chain Project Management (CCPM) principles:

### 1. Task Duration Buffer
- Tasks are planned at 50% of nominal duration
- The saved time becomes buffers to protect the schedule
- Encourages focus and removes padding from individual estimates

### 2. Critical Chain
- The longest chain of dependent tasks
- Highlighted in red on the GANTT chart
- Determines the minimum project duration

### 3. Buffers
- **Project Buffer**: Protects the project completion date
- **Feeding Buffers**: Protect the critical chain from delays in non-critical tasks
- Shown as yellow bars on the chart

### 4. Resource Leveling
- Automatically resolves resource conflicts
- Ensures no resource is double-booked
- Tasks are delayed if resource is unavailable

## Example Project

The included example demonstrates a software development project:

**Resources**:
- Developer Team
- Designer
- QA Team
- DevOps

**Tasks**:
1. Requirements Analysis (10 days, Developer Team)
2. UI/UX Design (8 days, Designer, after Requirements)
3. Backend Development (20 days, Developer Team, after Requirements)
4. Frontend Development (16 days, Developer Team, after Design)
5. API Integration (12 days, Developer Team, after Backend & Frontend)
6. Testing (10 days, QA Team, after Integration)
7. Deployment Setup (6 days, DevOps, after Testing)
8. Final Review (4 days, Developer Team, after Deployment)

This creates a realistic project with:
- Parallel work streams (Backend & Design)
- Resource constraints (Developer Team shared)
- Clear critical chain
- Appropriate buffers

## Technical Details

### Technologies Used
- **HTML5 Canvas**: For rendering the GANTT chart
- **Vanilla JavaScript**: No frameworks required
- **CSS3**: Modern styling and responsive design

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Performance
- Optimized for projects up to 100 tasks
- Real-time rendering and updates
- Efficient dependency calculation

## Tips for Best Results

1. **Start Simple**: Begin with a small project to understand the tool
2. **Define Resources First**: Add all resources before creating tasks
3. **Build Dependencies**: Add tasks in logical order with proper predecessors
4. **Review Critical Chain**: Focus on the critical chain tasks for project success
5. **Use Buffers**: Trust the buffer system to protect your schedule
6. **Realistic Estimates**: Provide honest nominal durations

## Limitations

Current version limitations:
- No persistence (data lost on page refresh)
- No export functionality (future feature)
- Basic drag-and-drop (task repositioning not yet implemented)
- No multi-project support

## Future Enhancements

Planned features:
- Save/Load projects to JSON
- Export to PNG/PDF
- Advanced resource calendars
- Progress tracking
- Fever chart visualization
- Task splitting and merging
- Milestone tracking
- Baseline comparison

## Support

For issues or questions about the VBA version, refer to the main README.md.

For the Interactive Canvas:
- Source code is in `app.js`
- Styling in `styles.css`
- HTML structure in `index.html`

## License

Same license as the main Critical Chain Simulator project.
