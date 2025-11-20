# Critical Chain Simulator

## What is it?

Critical Chain Project Management (CCPM) is a schedule network analysis technique that takes into account task dependencies, limited resources availability (people, equipment, physical space), and buffers necessary to complete the project successfully. CCPM helps project managers plan and manage the project’s schedule by concentrating on resources used in Critical Path (also known as the Critical Chain). 

Critical Chain Simulator is an easy to use software allowing the user to experiment with CCPM. It was originally created to be used during a training workshop hosted by a French consulting firm. It is Excel VBA based, providing familiar interface to new users. 

This repository does not give access to the full software. It is meant as backup for some modules and objects exported from the VBA project. You can check them out to get a grasp of the work that has been done. 

## Main features

![](demos/demo.gif)

- Resources & tasks creation / removal
- Resources & tasks dynamic editing
- GANTT diagram generation & update
  - Shortest project duration
  - Ressource conflicts avoidance
  - Primary and secondary chains generation
  - Buffer calculation and scheduling
- Project progress tracking through fever charts

## NEW: Interactive Web Canvas

This repository now includes a modern **web-based interactive canvas** that brings Critical Chain Project Management to your browser!

### 🆕 Version 2.0 - Enhanced Edition (Latest)
The enhanced version includes **all-new features** for professional project management:

#### New in v2.0:
- ✅ **Progress Tracking** - Track task completion with sliders (0-100%)
- ✅ **Fever Chart** - Real-time buffer consumption monitoring with color-coded zones
- ✅ **Save/Load** - Auto-save to browser + JSON export/import
- ✅ **Enhanced Drag-Drop** - Click and drag tasks to reposition on timeline
- ✅ **Current Day Tracker** - Visual marker showing project timeline progress
- ✅ **Task Status** - Not Started, In Progress, Completed with visual icons
- ✅ **Project Naming** - Organize multiple projects with meaningful names

**Quick Start v2.0**: Open `index-enhanced.html` in your browser

**Documentation**: See [ENHANCED_FEATURES.md](ENHANCED_FEATURES.md) for complete v2.0 guide

### Version 1.0 - Original Edition
The original version provides core CCPM visualization:

#### Features v1.0:
- **Interactive GANTT Chart** with HTML5 Canvas rendering
- **Visual Task Management** with drag-and-drop support
- **Real-time Critical Chain Visualization**
- **Resource Management** with conflict detection
- **Buffer Visualization** following CCPM methodology
- **Zoom Controls** for better project viewing
- **Click-to-view Task Details** for comprehensive information
- **Example Project** to get started quickly

**Quick Start v1.0**: Open `index.html` in your browser

**Documentation**: See [INTERACTIVE_CANVAS.md](INTERACTIVE_CANVAS.md) for v1.0 guide

### Technologies
- Pure HTML5, CSS3, and JavaScript
- No frameworks or dependencies required
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Fully responsive design
- LocalStorage for persistence (v2.0)