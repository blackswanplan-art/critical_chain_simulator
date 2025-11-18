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

### Quick Start
Simply open `index.html` in your web browser - no installation required!

### Features
- **Interactive GANTT Chart** with HTML5 Canvas rendering
- **Visual Task Management** with drag-and-drop support
- **Real-time Critical Chain Visualization**
- **Resource Management** with conflict detection
- **Buffer Visualization** following CCPM methodology
- **Zoom Controls** for better project viewing
- **Click-to-view Task Details** for comprehensive information
- **Example Project** to get started quickly

### Learn More
See [INTERACTIVE_CANVAS.md](INTERACTIVE_CANVAS.md) for detailed documentation, usage guide, and examples.

### Technologies
- Pure HTML5, CSS3, and JavaScript
- No frameworks or dependencies required
- Works in all modern browsers
- Fully responsive design