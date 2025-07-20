# Three.js Disconnected Lines 
## Line2 Performance Comparison - Single vs Multiple Objects

A Next.js application demonstrating high-performance interactive 3D line rendering using Three.js and React Three Fiber. This project compares single Line2 object optimization vs multiple Line2 objects for rendering 2000+ interactive lines with real-time editing capabilities.

## 🚀 Live Demo

**[View the live application](https://ithihasmadala.github.io/disconnected-lines-threejs)**

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **3D Graphics**: Three.js with React Three Fiber
- **Styling**: Tailwind CSS with shadcn/ui components
- **Language**: TypeScript
- **Deployment**: GitHub Pages (Static Export)

## 📦 Build & Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Deploy to GitHub Pages
pnpm deploy
```

## 🎯 Key Features

- **Performance Optimization**: Single Line2 object rendering for 2000+ lines
- **Interactive Editing**: Real-time point manipulation and line editing
- **Dynamic Point Management**: Add, delete, and drag points on lines
- **Performance Monitoring**: Real-time FPS and rendering statistics
- **Responsive Design**: Optimized for desktop and mobile devices

## 🏗️ Architecture

The application uses a sophisticated single Line2 optimization technique that consolidates all line segments into one efficient object, dramatically reducing draw calls and improving performance. See the detailed technical documentation below for implementation specifics.

---

## Understanding and Implementing Interactive Disconnected Lines in Three.js with React Three Fiber (Single Line2 Optimization)

This document details the architecture and implementation of the `DisconnectedLines` component, a highly optimized solution for rendering and interacting with thousands of individual lines in a Three.js scene using React Three Fiber. The core innovation lies in leveraging a single `Line2` object to represent all lines, significantly boosting performance.

---

### 1. Introduction

Rendering a large number of distinct 3D objects, especially lines, can quickly become a performance bottleneck in Three.js due to the overhead of individual draw calls. The `DisconnectedLines` component addresses this by consolidating all line segments into a single, highly efficient `Line2` object. This approach allows for smooth rendering and complex interactive features like hovering, selection, and dynamic point manipulation, even with thousands of lines.

---

### 2. Core Concept: Single `Line2` Optimization

Traditionally, one might create a separate `Line2` object for each line. However, each `Line2` object results in its own draw call, which can overwhelm the GPU when dealing with thousands of lines.

The `DisconnectedLines` component circumvents this by:

*   **`LineSegmentsGeometry`:** Instead of `LineGeometry` (which is for continuous lines), `LineSegmentsGeometry` is used. This geometry type is designed to hold a collection of disconnected line segments.
*   **Combined Data Arrays:** All line segments from all individual lines are concatenated into two large `Float32Array`s:
    *   `positions`: Stores the `[x, y, z]` coordinates for the start and end points of *every* segment. For `N` segments, this array will have `N * 2 * 3` elements.
    *   `colors`: Stores the `[r, g, b]` color values for the start and end points of *every* segment. This allows for per-vertex coloring, enabling dynamic highlights.
*   **`segmentToLineMap`:** This is a crucial lookup array. Since all segments are merged, we need a way to know which original line a given segment belongs to. `segmentToLineMap[segmentIndex]` stores the `lineIndex` of the line that the `segmentIndex`-th segment (in the combined `positions` array) is part of. This is vital for interaction logic (hover, selection).
*   **`linePoints`:** A nested array `linePoints[lineIndex][pointIndex]` stores the actual `[x, y, z]` coordinates for each point of each individual line. This is the "source of truth" for the line data, from which the `positions` and `colors` `Float32Array`s are generated.

By doing this, the entire collection of 2000 lines is rendered with **just one draw call**, leading to significant performance gains.

---

### 3. Component Structure (`DisconnectedLines`)

The `DisconnectedLines` component is a React functional component that leverages various hooks for state management, Three.js context, and performance optimization:

*   **State Management:**
    *   `lineRef`: `useRef<Line2>(null)` to hold a reference to the single `Line2` object in the scene.
    *   `spheresRef`: `useRef<Mesh[]>(null)` to hold references to the interactive spheres (points) of the currently selected line.
    *   `orbitControlsRef`: `useRef<any>(null)` for controlling the `OrbitControls` component.
    *   `hoveredLineIndex`: `useState<number | null>(null)` to track the index of the line currently under the mouse cursor.
    *   `selectedLineIndex`: `useState<number | null>(null)` to track the index of the currently selected line.
    *   `lineData`: `useState<LineData | null>(null)` to store the comprehensive data for all lines, including `positions`, `colors`, `segmentToLineMap`, and `linePoints`.
    *   `isDragging`, `draggedSphere`, `dragPlane`: State for managing point dragging interactions.
*   **Three.js Context:**
    *   `useThree()`: Provides access to the Three.js `camera`, `gl` (WebGLRenderer), and `scene` objects, essential for raycasting and scene manipulation.
*   **Performance & Utilities:**
    *   `raycaster`: `useMemo(() => new Raycaster(), [])` for efficient raycasting.
    *   `mouse`: `useMemo(() => new Vector2(), [])` for storing normalized mouse coordinates.
    *   `useCallback` and `useMemo`: Used extensively to memoize functions and expensive computations, preventing unnecessary re-renders and recalculations.

---

### 4. Initialization (`initialLineData` `useMemo` and `useEffect`)

The initial set of lines is generated once when the component mounts:

```typescript
const initialLineData = useMemo((): LineData => {
  const numLines = 2000;
  const pointsPerLine = 50;

  // ... (grid and spacing calculations) ...

  const positions = new Float32Array(totalPoints * 3);
  const colors = new Float32Array(totalPoints * 3);
  const originalColors = new Float32Array(totalPoints * 3); // To reset colors
  const segmentToLineMap: number[] = [];
  const lineColors: Color[] = []; // Stores base color for each line
  const linePoints: [number, number, number][][] = []; // Stores actual points for each line

  let positionIndex = 0;
  let colorIndex = 0;
  let segmentIndex = 0;

  for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
    // Generate random points for the current line
    const currentLinePoints: [number, number, number][] = [];
    // ... (populate currentLinePoints) ...

    linePoints[lineIndex] = currentLinePoints; // Store points for this line

    // Convert currentLinePoints to segments and populate positions/colors arrays
    for (let segmentIdx = 0; segmentIdx < segmentsPerLine; segmentIdx++) {
      const point1 = currentLinePoints[segmentIdx];
      const point2 = currentLinePoints[segmentIdx + 1];

      segmentToLineMap[segmentIndex] = lineIndex; // Map segment to its line

      // Populate positions and colors arrays for point1 and point2
      // ...
      positionIndex += 6;
      colorIndex += 6;
      segmentIndex++;
    }
  }
  return { positions, colors, originalColors, segmentToLineMap, lineColors, segmentsPerLine, linePoints };
}, []);

useEffect(() => {
  setLineData(initialLineData);
}, [initialLineData]);
```

*   **Line Generation:** Lines are randomly distributed within a 3D grid. Each line is assigned a unique color using `setHSL`.
*   **Data Population:** The `for` loops iterate through each line and its points, converting them into segments. For each segment, the coordinates and colors of its two points are added to the `positions` and `colors` `Float32Array`s.
*   **Mapping:** Crucially, `segmentToLineMap` is populated, linking each segment in the flat `positions` array back to its original `lineIndex`.

---

### 5. Geometry and Material Setup

The `useMemo` hook is used to create the `LineSegmentsGeometry` and `LineMaterial` based on the `lineData`:

```typescript
const { geometry, material } = useMemo(() => {
  if (!lineData) return { geometry: null, material: null };

  const geom = new LineSegmentsGeometry();
  geom.setPositions(lineData.positions); // Set all segment positions
  geom.setColors(lineData.colors);     // Set all segment colors

  const mat = new LineMaterial({
    vertexColors: true, // Enable per-vertex coloring
    linewidth: 5,       // Line thickness
    resolution: [window.innerWidth, window.innerHeight], // Required for LineMaterial
  });

  return { geometry: geom, material: mat };
}, [lineData]); // Recalculate only when lineData changes

// In the render function:
return (
  <>
    <primitive ref={lineRef} object={new Line2(geometry, material)} />
    <OrbitControls /* ... */ />
  </>
);
```

*   The `LineSegmentsGeometry` is created and its `positions` and `colors` are set from the `lineData`.
*   A `LineMaterial` is configured with `vertexColors: true` to utilize the per-segment colors.
*   The `<primitive>` component from `react-three-fiber` is used to render the `Line2` object, which combines the geometry and material.

---

### 6. Interaction Logic

All interactions (hover, selection, point manipulation, line deletion) are handled through event listeners attached directly to the `gl.domElement` (the canvas) and `window`.

#### Raycasting Fundamentals

Raycasting is the core mechanism for detecting interactions with 3D objects:

```typescript
// In useEffect for mouse events:
const rect = gl.domElement.getBoundingClientRect();
mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
raycaster.setFromCamera(mouse, camera);
raycaster.params.Line2 = { threshold: 20 }; // Makes lines easier to pick
```

*   Mouse coordinates are converted to normalized device coordinates (`-1` to `1`).
*   `raycaster.setFromCamera` creates a ray originating from the camera through the mouse position.
*   `raycaster.params.Line2.threshold` is crucial for thin lines, expanding their clickable area.

#### Hover Detection (`handleMouseMove`)

```typescript
// Inside handleMouseMove:
const intersects = raycaster.intersectObject(lineRef.current, false);

if (intersects.length > 0) {
  const intersection = intersects[0];
  const segmentIndex = intersection.index !== undefined ? intersection.index : intersection.faceIndex;

  if (segmentIndex !== undefined && segmentIndex >= 0 && segmentIndex < lineData.segmentToLineMap.length) {
    const lineIndex = lineData.segmentToLineMap[segmentIndex]; // Get line index from segment
    if (lineIndex !== hoveredLineIndex) {
      setHoveredLineIndex(lineIndex);
    }
  }
} else {
  if (hoveredLineIndex !== null) {
    setHoveredLineIndex(null);
  }
}
// Update colors in a separate useEffect based on hoveredLineIndex
```

*   `raycaster.intersectObject` checks for intersections with the single `Line2` object.
*   The `intersection.index` (or `faceIndex`) gives the index of the intersected segment.
*   `segmentToLineMap` is used to translate the segment index back to the original `lineIndex`.
*   The `useEffect` that depends on `hoveredLineIndex` then updates the `colors` `Float32Array` of the `LineSegmentsGeometry` to apply the hover highlight (yellow).

#### Line Selection (`handleClick`)

```typescript
// Inside handleClick:
const intersects = raycaster.intersectObject(lineRef.current, false);

if (intersects.length > 0) {
  const lineIndex = lineData.segmentToLineMap[segmentIndex]; // Get line index

  if (selectedLineIndex === lineIndex) {
    // Line is already selected - add a point
    addPointToLine(lineIndex, intersection.point);
  } else {
    // Select the line and create spheres
    setSelectedLineIndex(lineIndex);
    createSpheresForLine(lineIndex);
  }
} else {
  // Clicked on empty space - deselect
  setSelectedLineIndex(null);
  removeSpheres();
}
// Color update in useEffect based on selectedLineIndex
```

*   Similar to hover, `lineIndex` is determined.
*   If the clicked line is already selected, it triggers point addition.
*   Otherwise, `setSelectedLineIndex` is updated, and `createSpheresForLine` is called to visualize the line's points.
*   Clicking empty space deselects the current line and removes its spheres.
*   The `useEffect` that depends on `selectedLineIndex` updates the `colors` `Float32Array` for the selection highlight (magenta).

#### Point Manipulation (Spheres)

When a line is selected, its individual points are represented by `Mesh` (sphere) objects.

*   **`createSpheresForLine(lineIndex)`:**
    *   Iterates through `lineData.linePoints[lineIndex]`.
    *   For each point, creates a `SphereGeometry` and `MeshStandardMaterial`.
    *   Sets the sphere's position.
    *   Crucially, stores `lineIndex` and `pointIndex` in `sphere.userData` for later reference during interactions.
    *   Adds the sphere to the `scene` and `spheresRef.current`.
*   **`removeSpheres()`:**
    *   Iterates through `spheresRef.current`, removes each sphere from the `scene`, and disposes of its geometry and material to prevent memory leaks.
*   **Dragging Points (`handleMouseDown`, `handleMouseMove` for dragging, `handleMouseUp`):**
    *   `handleMouseDown`: Detects clicks on spheres. If a sphere is clicked, `isDragging` is set, `draggedSphere` is stored, and `OrbitControls` are temporarily disabled. A `dragPlane` is set up perpendicular to the camera to ensure smooth dragging in 3D space.
    *   `handleMouseMove` (when dragging): Uses `raycaster.ray.intersectPlane` to find the intersection point on the `dragPlane`. The `draggedSphere`'s position is updated, and `updatePointPosition` is called.
    *   `handleMouseUp`: Resets `isDragging`, clears `draggedSphere`, and re-enables `OrbitControls`.
*   **`updatePointPosition(lineIndex, pointIndex, newPosition)`:**
    *   Modifies `lineData.linePoints[lineIndex][pointIndex]` with the `newPosition`.
    *   Calls `rebuildGeometry` to update the underlying `positions` and `colors` `Float32Array`s of the single `Line2` object.
*   **Deleting Points (`handleContextMenu`):**
    *   Detects right-clicks on spheres.
    *   Retrieves `lineIndex` and `pointIndex` from `intersectedSphere.userData`.
    *   Calls `deletePoint(lineIndex, pointIndex)`.
*   **`deletePoint(lineIndex, pointIndex)`:**
    *   Removes the point at `pointIndex` from `lineData.linePoints[lineIndex]` using `splice`.
    *   **Important:** Prevents deletion if it would result in a line with fewer than 2 points (a line needs at least two points to exist).
    *   Calls `rebuildGeometry` to update the `Line2` object.
    *   Calls `createSpheresForLine` again to refresh the spheres for the modified line.
*   **Adding Points (`handleClick` when line is selected):**
    *   When a selected line is clicked, `intersection.point` provides the 3D coordinates where the click occurred on the line.
    *   `findClosestSegment(lineIndex, intersectionPoint)`: This utility function iterates through the segments of the specified line and finds the segment closest to the `intersectionPoint`. This determines where the new point should be inserted.
    *   `addPointToLine(lineIndex, intersectionPoint)`:
        *   Inserts the `intersectionPoint` into `lineData.linePoints[lineIndex]` at the appropriate position (after the first point of the closest segment).
        *   Calls `rebuildGeometry`.
        *   Creates a new sphere for the newly added point and adds it to the scene.

#### Line Deletion (`handleDeleteLineEvent` and `deleteLine`)

The `Component` (parent of `DisconnectedLines`) dispatches a custom event (`deleteLine`) when the "Delete Line" button is clicked.

```typescript
// In DisconnectedLines component:
useEffect(() => {
  const handleDeleteLineEvent = (event: CustomEvent) => {
    const { lineIndex } = event.detail;
    if (lineIndex === selectedLineIndex) {
      deleteLine(lineIndex);
      setSelectedLineIndex(null); // Deselect after deletion
      onLineDeleted?.(lineIndex); // Notify parent
    }
  };
  window.addEventListener("deleteLine", handleDeleteLineEvent as EventListener);
  return () => window.removeEventListener("deleteLine", handleDeleteLineEvent as EventListener);
}, [selectedLineIndex, deleteLine, onLineDeleted]);

// The actual deletion logic:
const deleteLine = useCallback((lineIndex: number) => {
  if (!lineData) return;
  const newLinePoints = [...lineData.linePoints];
  newLinePoints[lineIndex] = []; // Set to empty array to maintain indices for other lines
  const geometryData = rebuildGeometry(newLinePoints, lineData.lineColors);
  setLineData({
    ...geometryData,
    lineColors: lineData.lineColors,
    segmentsPerLine: lineData.segmentsPerLine,
    linePoints: newLinePoints,
  });
  removeSpheres(); // Remove spheres of the deleted line
}, [lineData, rebuildGeometry]);
```

*   The `deleteLine` function sets the `linePoints` entry for the deleted line to an empty array. This is a clever way to "remove" the line while preserving the indices of other lines in the `linePoints` array, simplifying `segmentToLineMap` updates.
*   `rebuildGeometry` is called to update the `Line2` object, effectively removing the line from rendering.

---

### 7. Utility Function: `rebuildGeometry`

This is the most critical utility function, responsible for updating the `positions` and `colors` `Float32Array`s whenever `linePoints` changes (due to point addition, deletion, or movement).

```typescript
const rebuildGeometry = useCallback((newLinePoints: [number, number, number][][], lineColors: Color[]) => {
  // Calculate new total segments based on newLinePoints
  // Create new Float32Array for positions, colors, originalColors
  // Create new segmentToLineMap

  let positionIndex = 0;
  let colorIndex = 0;
  let segmentIdx = 0;

  for (let lineIdx = 0; lineIdx < newLinePoints.length; lineIdx++) {
    const points = newLinePoints[lineIdx];
    if (!points || points.length < 2) continue; // Skip empty or invalid lines

    const color = lineColors[lineIdx];
    // Iterate through points, create segments, and populate newPositions, newColors, newSegmentToLineMap
    // ...
  }

  // Update the geometry of the existing Line2 object
  if (lineRef.current && lineRef.current.geometry) {
    const geom = lineRef.current.geometry as LineSegmentsGeometry;
    geom.setPositions(newPositions);
    geom.setColors(newColors);
    geom.attributes.position.needsUpdate = true; // Important for Three.js to re-render
    geom.attributes.color.needsUpdate = true;
  }

  return {
    positions: newPositions,
    colors: newColors,
    originalColors: newOriginalColors,
    segmentToLineMap: newSegmentToLineMap,
  };
}, []);
```

*   This function recalculates the `positions`, `colors`, and `segmentToLineMap` arrays from the updated `linePoints`.
*   It then updates the attributes of the existing `LineSegmentsGeometry` (`lineRef.current.geometry`).
*   Setting `needsUpdate = true` on the attributes is crucial to tell Three.js that the buffer data has changed and needs to be re-uploaded to the GPU.

---

### 8. Performance Considerations

*   **Single Draw Call:** The primary optimization is rendering all lines as a single `Line2` object, drastically reducing draw calls.
*   **`Float32Array`s:** Using typed arrays (`Float32Array`) is essential for efficient data transfer to the GPU.
*   **Memoization (`useMemo`, `useCallback`):** Prevents unnecessary re-creations of objects and functions, optimizing React's rendering cycle.
*   **Direct DOM Event Listeners:** For high-frequency events like `mousemove`, attaching listeners directly to `gl.domElement` bypasses React's synthetic event system, providing better performance.
*   **Object Disposal:** Explicitly disposing of Three.js geometries and materials (`sphere.geometry.dispose()`, `sphere.material.dispose()`) when objects are removed from the scene is vital to prevent memory leaks, especially for dynamically created spheres.
*   **Selective Geometry Updates:** Instead of creating a whole new `LineSegmentsGeometry` on every change, `rebuildGeometry` updates the existing geometry's attributes, which is more efficient.

---

### 9. Conclusion

The `DisconnectedLines` component provides a robust and performant solution for interactive line rendering in Three.js. By intelligently combining all line segments into a single `Line2` object and managing data updates efficiently, it overcomes common performance challenges associated with rendering complex 3D scenes. This architecture serves as an excellent foundation for building sophisticated 3D visualization and editing tools.