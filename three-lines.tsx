"use client"

import { useRef, useMemo, useEffect, useState, useCallback } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Line2 } from "three/examples/jsm/lines/Line2.js"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js"
import { Color, Raycaster, Vector2, SphereGeometry, MeshStandardMaterial, Mesh, Vector3, Plane } from "three"
import { Button } from "@/components/ui/button"
import DisconnectedLinesMultiple from "@/components/DisconnectedLinesMultiple"
import Stats from "stats.js"

interface LineData {
  positions: Float32Array
  colors: Float32Array
  originalColors: Float32Array
  segmentToLineMap: number[]
  lineColors: Color[]
  segmentsPerLine: number
  linePoints: [number, number, number][][]
}

interface DisconnectedLinesProps {
  onDebugUpdate: (info: string, hoveredLine: number | null, selectedLine: number | null) => void
  onLineDeleted?: (lineIndex: number) => void
  setInteractionStats: (stats: any) => void
  setPerformanceStats: (stats: any) => void
}

function DisconnectedLines({ onDebugUpdate, onLineDeleted, setInteractionStats, setPerformanceStats }: DisconnectedLinesProps) {
  const lineRef = useRef<Line2>(null)
  const spheresRef = useRef<Mesh[]>([])
  const orbitControlsRef = useRef<any>(null)
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null)
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null)
  const [lineData, setLineData] = useState<LineData | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedSphere, setDraggedSphere] = useState<Mesh | null>(null)
  const [dragPlane] = useState(new Plane())
  const { camera, gl, scene } = useThree()
  const raycaster = useMemo(() => new Raycaster(), [])
  const mouse = useMemo(() => new Vector2(), [])
  
  // Update renderer stats
  useEffect(() => {
    const updateRendererStats = () => {
      if (gl && gl.info) {
        setPerformanceStats(prev => ({
          ...prev,
          triangles: gl.info.render.triangles || 0,
          renderCalls: gl.info.render.calls || 0,
          drawCalls: gl.info.render.drawCalls || 0
        }))
      }
    }
    
    // Update stats every second
    const interval = setInterval(updateRendererStats, 1000)
    return () => clearInterval(interval)
  }, [gl, setPerformanceStats])

  // Initialize line data
  const initialLineData = useMemo((): LineData => {
    const numLines = 5000
    const pointsPerLine = 50

    // Create a 3D grid to distribute lines
    const gridSize = Math.ceil(Math.pow(numLines, 1 / 3))
    const spacing = 30 // Reduced spacing to fit more lines

    // Calculate total segments needed
    const segmentsPerLine = pointsPerLine - 1
    const totalSegments = numLines * segmentsPerLine
    const totalPoints = totalSegments * 2

    const positions = new Float32Array(totalPoints * 3)
    const colors = new Float32Array(totalPoints * 3)
    const originalColors = new Float32Array(totalPoints * 3)
    const segmentToLineMap: number[] = []
    const lineColors: Color[] = []
    const linePoints: [number, number, number][][] = []

    let positionIndex = 0
    let colorIndex = 0
    let segmentIndex = 0

    for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
      // Calculate grid position for this line
      const gridX = lineIndex % gridSize
      const gridY = Math.floor(lineIndex / gridSize) % gridSize
      const gridZ = Math.floor(lineIndex / (gridSize * gridSize))

      // Center position for this line's region
      const centerX = (gridX - gridSize / 2) * spacing
      const centerY = (gridY - gridSize / 2) * spacing
      const centerZ = (gridZ - gridSize / 2) * spacing

      // Generate a unique color for this line
      const hue = (lineIndex / numLines) * 360
      const color = new Color().setHSL(hue / 360, 0.8, 0.6)
      lineColors.push(color.clone())

      // Generate points for this line within its own region
      const currentLinePoints: [number, number, number][] = []
      const localRange = 12 // Reduced range to prevent overlap

      for (let pointIndex = 0; pointIndex < pointsPerLine; pointIndex++) {
        const x = centerX + (Math.random() - 0.5) * localRange
        const y = centerY + (Math.random() - 0.5) * localRange
        const z = centerZ + (Math.random() - 0.5) * localRange
        currentLinePoints.push([x, y, z])
      }

      // Store the points for this line
      linePoints[lineIndex] = currentLinePoints

      // Convert line points to segments
      for (let segmentIdx = 0; segmentIdx < segmentsPerLine; segmentIdx++) {
        const point1 = currentLinePoints[segmentIdx]
        const point2 = currentLinePoints[segmentIdx + 1]

        // Map this segment to its line
        segmentToLineMap[segmentIndex] = lineIndex

        // Add first point of segment
        positions[positionIndex] = point1[0]
        positions[positionIndex + 1] = point1[1]
        positions[positionIndex + 2] = point1[2]

        // Add second point of segment
        positions[positionIndex + 3] = point2[0]
        positions[positionIndex + 4] = point2[1]
        positions[positionIndex + 5] = point2[2]

        // Add colors for both points
        colors[colorIndex] = color.r
        colors[colorIndex + 1] = color.g
        colors[colorIndex + 2] = color.b
        originalColors[colorIndex] = color.r
        originalColors[colorIndex + 1] = color.g
        originalColors[colorIndex + 2] = color.b

        colors[colorIndex + 3] = color.r
        colors[colorIndex + 4] = color.g
        colors[colorIndex + 5] = color.b
        originalColors[colorIndex + 3] = color.r
        originalColors[colorIndex + 4] = color.g
        originalColors[colorIndex + 5] = color.b

        positionIndex += 6
        colorIndex += 6
        segmentIndex++
      }
    }

    return { positions, colors, originalColors, segmentToLineMap, lineColors, segmentsPerLine, linePoints }
  }, [])

  // Set initial line data
  useEffect(() => {
    setLineData(initialLineData)
  }, [initialLineData])

  // Function to rebuild geometry from current line data
  const rebuildGeometry = useCallback((newLinePoints: [number, number, number][][], lineColors: Color[]) => {
    const numLines = newLinePoints.length
    let totalSegments = 0

    // Calculate new total segments
    for (let i = 0; i < numLines; i++) {
      if (newLinePoints[i] && newLinePoints[i].length > 1) {
        totalSegments += newLinePoints[i].length - 1
      }
    }

    const totalPoints = totalSegments * 2
    const newPositions = new Float32Array(totalPoints * 3)
    const newColors = new Float32Array(totalPoints * 3)
    const newOriginalColors = new Float32Array(totalPoints * 3)
    const newSegmentToLineMap: number[] = []

    let positionIndex = 0
    let colorIndex = 0
    let segmentIdx = 0

    for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
      const points = newLinePoints[lineIdx]
      if (!points || points.length < 2) continue // Skip lines with less than 2 points

      const color = lineColors[lineIdx]
      const segmentsInLine = points.length - 1

      // Convert line points to segments
      for (let i = 0; i < segmentsInLine; i++) {
        const point1 = points[i]
        const point2 = points[i + 1]

        // Map this segment to its line
        newSegmentToLineMap[segmentIdx] = lineIdx

        // Add first point of segment
        newPositions[positionIndex] = point1[0]
        newPositions[positionIndex + 1] = point1[1]
        newPositions[positionIndex + 2] = point1[2]

        // Add second point of segment
        newPositions[positionIndex + 3] = point2[0]
        newPositions[positionIndex + 4] = point2[1]
        newPositions[positionIndex + 5] = point2[2]

        // Add colors for both points
        newColors[colorIndex] = color.r
        newColors[colorIndex + 1] = color.g
        newColors[colorIndex + 2] = color.b
        newOriginalColors[colorIndex] = color.r
        newOriginalColors[colorIndex + 1] = color.g
        newOriginalColors[colorIndex + 2] = color.b

        newColors[colorIndex + 3] = color.r
        newColors[colorIndex + 4] = color.g
        newColors[colorIndex + 5] = color.b
        newOriginalColors[colorIndex + 3] = color.r
        newOriginalColors[colorIndex + 4] = color.g
        newOriginalColors[colorIndex + 5] = color.b

        positionIndex += 6
        colorIndex += 6
        segmentIdx++
      }
    }

    return {
      positions: newPositions,
      colors: newColors,
      originalColors: newOriginalColors,
      segmentToLineMap: newSegmentToLineMap,
    }
  }, [])

  // Function to delete entire line
  const deleteLine = useCallback(
    (lineIndex: number) => {
      if (!lineData) return

      console.log(`Deleting line ${lineIndex}`)

      // Create new line data without the deleted line
      const newLinePoints = [...lineData.linePoints]
      const newLineColors = [...lineData.lineColors]

      // Remove the line (set to empty array to maintain indices)
      newLinePoints[lineIndex] = []

      // Rebuild geometry
      const geometryData = rebuildGeometry(newLinePoints, newLineColors)

      // Update line data
      const newLineData: LineData = {
        ...geometryData,
        lineColors: newLineColors,
        segmentsPerLine: lineData.segmentsPerLine,
        linePoints: newLinePoints,
      }

      setLineData(newLineData)

      // Clear selection and remove spheres
      setSelectedLineIndex(null)
      removeSpheres()

      console.log(`Line ${lineIndex} deleted`)
    },
    [lineData, rebuildGeometry],
  )

  // Function to delete a point from a line
  const deletePoint = useCallback(
    (lineIndex: number, pointIndex: number) => {
      if (!lineData) return

      console.log(`Deleting point ${pointIndex} from line ${lineIndex}`)

      const currentPoints = lineData.linePoints[lineIndex]
      if (!currentPoints || currentPoints.length <= 2) {
        console.log("Cannot delete point: line would have less than 2 points")
        return
      }

      // Create new line data with the point removed
      const newLinePoints = [...lineData.linePoints]
      const newPoints = [...currentPoints]
      newPoints.splice(pointIndex, 1)
      newLinePoints[lineIndex] = newPoints

      // Rebuild geometry
      const geometryData = rebuildGeometry(newLinePoints, lineData.lineColors)

      // Update line data
      const newLineData: LineData = {
        ...geometryData,
        lineColors: lineData.lineColors,
        segmentsPerLine: lineData.segmentsPerLine,
        linePoints: newLinePoints,
      }

      setLineData(newLineData)

      console.log(`Point ${pointIndex} deleted from line ${lineIndex}, line now has ${newPoints.length} points`)
    },
    [lineData, rebuildGeometry],
  )

  // Function to update a point position
  const updatePointPosition = useCallback(
    (lineIndex: number, pointIndex: number, newPosition: Vector3) => {
      if (!lineData) return

      // Create new line data with the updated point
      const newLinePoints = [...lineData.linePoints]
      const newPoints = [...newLinePoints[lineIndex]]
      newPoints[pointIndex] = [newPosition.x, newPosition.y, newPosition.z]
      newLinePoints[lineIndex] = newPoints

      // Rebuild geometry
      const geometryData = rebuildGeometry(newLinePoints, lineData.lineColors)

      // Update line data
      const newLineData: LineData = {
        ...geometryData,
        lineColors: lineData.lineColors,
        segmentsPerLine: lineData.segmentsPerLine,
        linePoints: newLinePoints,
      }

      setLineData(newLineData)
    },
    [lineData, rebuildGeometry],
  )

  // Function to find the closest segment to an intersection point
  const findClosestSegment = useCallback(
    (lineIndex: number, intersectionPoint: Vector3): number => {
      if (!lineData) return -1

      const points = lineData.linePoints[lineIndex]
      let closestSegmentIndex = 0
      let minDistance = Number.POSITIVE_INFINITY

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = new Vector3(points[i][0], points[i][1], points[i][2])
        const p2 = new Vector3(points[i + 1][0], points[i + 1][1], points[i + 1][2])

        // Find the closest point on the line segment to the intersection point
        const line = new Vector3().subVectors(p2, p1)
        const lineLength = line.length()

        if (lineLength === 0) continue

        const t = Math.max(0, Math.min(1, intersectionPoint.clone().sub(p1).dot(line) / (lineLength * lineLength)))
        const closestPoint = p1.clone().add(line.multiplyScalar(t))
        const distance = intersectionPoint.distanceTo(closestPoint)

        if (distance < minDistance) {
          minDistance = distance
          closestSegmentIndex = i
        }
      }

      return closestSegmentIndex
    },
    [lineData],
  )

  // Function to add a point to a line
  const addPointToLine = useCallback(
    (lineIndex: number, intersectionPoint: Vector3) => {
      if (!lineData) return

      console.log(`Adding point to line ${lineIndex} at`, intersectionPoint)

      // Find the closest segment
      const segmentIndex = findClosestSegment(lineIndex, intersectionPoint)
      console.log(`Closest segment: ${segmentIndex}`)

      // Create new line data with the added point
      const newLinePoints = [...lineData.linePoints]
      const currentPoints = [...newLinePoints[lineIndex]]

      // Insert the new point after the segment's first point
      const insertIndex = segmentIndex + 1
      currentPoints.splice(insertIndex, 0, [intersectionPoint.x, intersectionPoint.y, intersectionPoint.z])
      newLinePoints[lineIndex] = currentPoints

      console.log(`Inserted point at index ${insertIndex}, line now has ${currentPoints.length} points`)

      // Rebuild geometry
      const geometryData = rebuildGeometry(newLinePoints, lineData.lineColors)

      // Update line data
      const newLineData: LineData = {
        ...geometryData,
        lineColors: lineData.lineColors,
        segmentsPerLine: lineData.segmentsPerLine,
        linePoints: newLinePoints,
      }

      setLineData(newLineData)

      // Add a new sphere at the intersection point
      const sphereGeometry = new SphereGeometry(1, 8, 6)
      const sphereMaterial = new MeshStandardMaterial({
        color: 0x00ff00, // Green for new points
        emissive: 0x004400,
      })

      const newSphere = new Mesh(sphereGeometry, sphereMaterial)
      newSphere.position.copy(intersectionPoint)
      newSphere.userData = { lineIndex, pointIndex: insertIndex, isNewPoint: true }
      scene.add(newSphere)
      spheresRef.current.push(newSphere)

      console.log(`Added new sphere, total spheres: ${spheresRef.current.length}`)
    },
    [lineData, findClosestSegment, rebuildGeometry, scene],
  )

  // Update geometry when lineData changes
  const { geometry, material } = useMemo(() => {
    if (!lineData) return { geometry: null, material: null }

    const geom = new LineSegmentsGeometry()
    geom.setPositions(lineData.positions)
    geom.setColors(lineData.colors)

    const mat = new LineMaterial({
      vertexColors: true,
      linewidth: 5,
      resolution: [window.innerWidth, window.innerHeight],
    })

    return { geometry: geom, material: mat }
  }, [lineData])

  // Function to create spheres for a selected line
  const createSpheresForLine = useCallback(
    (lineIndex: number) => {
      if (!lineData) return

      // Remove existing spheres
      removeSpheres()

      const points = lineData.linePoints[lineIndex]
      if (!points || points.length === 0) return

      const sphereGeometry = new SphereGeometry(1, 8, 6)
      const originalSphereMaterial = new MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x444444,
      })

      const newSpheres: Mesh[] = []

      points.forEach((point, index) => {
        const sphere = new Mesh(sphereGeometry, originalSphereMaterial)
        sphere.position.set(point[0], point[1], point[2])
        sphere.userData = { lineIndex, pointIndex: index, isNewPoint: false }
        scene.add(sphere)
        newSpheres.push(sphere)
      })

      spheresRef.current = newSpheres
      console.log(`Created ${newSpheres.length} spheres for line ${lineIndex}`)
    },
    [lineData, scene],
  )

  // Function to remove all spheres
  const removeSpheres = useCallback(() => {
    spheresRef.current.forEach((sphere) => {
      scene.remove(sphere)
      sphere.geometry.dispose()
      if (Array.isArray(sphere.material)) {
        sphere.material.forEach((mat: any) => mat.dispose())
      } else {
        sphere.material.dispose()
      }
    })
    spheresRef.current = []
  }, [scene])

  // Update performance stats when line data changes
  useEffect(() => {
    if (lineData) {
      const totalPoints = lineData.positions.length / 3
      const totalLines = lineData.linePoints.filter(points => points && points.length > 0).length
      const totalSegments = lineData.segmentToLineMap.length
      const totalVertices = totalPoints
      const totalTriangles = spheresRef.current.length * 96 // Approximate triangles per sphere
      
      setPerformanceStats((prev: any) => ({
        ...prev,
        points: totalPoints,
        vertices: totalVertices,
        segments: totalSegments,
        lines: totalLines,
        triangles: totalTriangles
      }))
    }
  }, [lineData, setPerformanceStats])

  // Right-click handler for point deletion
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const start = performance.now()
      event.preventDefault()

      if (selectedLineIndex === null || isDragging) return

      // Convert mouse coordinates to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      // Update raycaster
      raycaster.setFromCamera(mouse, camera)

      // Check for intersections with spheres
      const sphereIntersects = raycaster.intersectObjects(spheresRef.current, false)

      if (sphereIntersects.length > 0) {
        const intersectedSphere = sphereIntersects[0].object as Mesh
        const userData = intersectedSphere.userData

        if (userData.lineIndex === selectedLineIndex) {
          console.log(`Right-clicked on point ${userData.pointIndex} of line ${userData.lineIndex}`)

          // Delete the point
          deletePoint(userData.lineIndex, userData.pointIndex)

          const debugInfo = `Deleted point ${userData.pointIndex} from line ${userData.lineIndex}`
          onDebugUpdate(debugInfo, hoveredLineIndex, selectedLineIndex)
          setInteractionStats((prev: any) => ({ ...prev, deletePoint: performance.now() - start }))
        }
      }
    }

    gl.domElement.addEventListener("contextmenu", handleContextMenu)
    return () => gl.domElement.removeEventListener("contextmenu", handleContextMenu)
  }, [selectedLineIndex, camera, gl, raycaster, mouse, deletePoint, hoveredLineIndex, onDebugUpdate, isDragging])

  // Mouse down handler for sphere dragging
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (selectedLineIndex === null || event.button !== 0) return // Only left mouse button

      // Convert mouse coordinates to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      // Update raycaster
      raycaster.setFromCamera(mouse, camera)

      // Check for intersections with spheres
      const sphereIntersects = raycaster.intersectObjects(spheresRef.current, false)

      if (sphereIntersects.length > 0) {
        const intersectedSphere = sphereIntersects[0].object as Mesh
        const userData = intersectedSphere.userData

        if (userData.lineIndex === selectedLineIndex) {
          // Start dragging
          setIsDragging(true)
          setDraggedSphere(intersectedSphere)

          // Disable orbit controls
          if (orbitControlsRef.current) {
            orbitControlsRef.current.enabled = false
          }

          // Set up drag plane perpendicular to camera
          const cameraDirection = new Vector3()
          camera.getWorldDirection(cameraDirection)
          dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, intersectedSphere.position)

          console.log(`Started dragging point ${userData.pointIndex} of line ${userData.lineIndex}`)
        }
      }
    }

    gl.domElement.addEventListener("mousedown", handleMouseDown)
    return () => gl.domElement.removeEventListener("mousedown", handleMouseDown)
  }, [selectedLineIndex, camera, gl, raycaster, mouse, dragPlane])

  // Mouse move handler for dragging and hover detection
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const start = performance.now()
      if (!lineRef.current || !lineData) return

      // Convert mouse coordinates to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      if (isDragging && draggedSphere) {
        // Handle sphere dragging
        raycaster.setFromCamera(mouse, camera)

        const intersectionPoint = new Vector3()
        if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
          // Update sphere position
          draggedSphere.position.copy(intersectionPoint)

          // Update line data
          const userData = draggedSphere.userData
          updatePointPosition(userData.lineIndex, userData.pointIndex, intersectionPoint)

          const debugInfo = `Dragging point ${userData.pointIndex} of line ${userData.lineIndex}`
          onDebugUpdate(debugInfo, hoveredLineIndex, selectedLineIndex)
        }
        setInteractionStats((prev: any) => ({ ...prev, drag: performance.now() - start }))
      } else {
        // Handle hover detection
        raycaster.setFromCamera(mouse, camera)
        raycaster.params.Line2 = { threshold: 20 }

        // Check for intersections
        const intersects = raycaster.intersectObject(lineRef.current, false)

        if (intersects.length > 0) {
          const intersection = intersects[0]
          const segmentIndex = intersection.index !== undefined ? intersection.index : intersection.faceIndex

          if (segmentIndex !== undefined && segmentIndex >= 0 && segmentIndex < lineData.segmentToLineMap.length) {
            const lineIndex = lineData.segmentToLineMap[segmentIndex]

            const debugInfo = `Hover - Line: ${lineIndex} | Selected: ${selectedLineIndex !== null ? selectedLineIndex : "None"} | Points: ${lineData.linePoints[lineIndex]?.length || 0}`
            onDebugUpdate(debugInfo, lineIndex, selectedLineIndex)

            if (lineIndex !== hoveredLineIndex) {
              setHoveredLineIndex(lineIndex)
            }
          }
        } else {
          const debugInfo = `No hover | Selected: ${selectedLineIndex !== null ? selectedLineIndex : "None"}`
          onDebugUpdate(debugInfo, null, selectedLineIndex)

          if (hoveredLineIndex !== null) {
            setHoveredLineIndex(null)
          }
        }
        setInteractionStats((prev: any) => ({ ...prev, raycaster: performance.now() - start }))
      }
    }

    gl.domElement.addEventListener("mousemove", handleMouseMove)
    return () => gl.domElement.removeEventListener("mousemove", handleMouseMove)
  }, [
    camera,
    gl,
    raycaster,
    mouse,
    hoveredLineIndex,
    selectedLineIndex,
    lineData,
    onDebugUpdate,
    isDragging,
    draggedSphere,
    dragPlane,
    updatePointPosition,
  ])

  // Mouse up handler for ending drag
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        setDraggedSphere(null)

        // Re-enable orbit controls
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = true
        }

        console.log("Stopped dragging")
      }
    }

    window.addEventListener("mouseup", handleMouseUp)
    return () => window.removeEventListener("mouseup", handleMouseUp)
  }, [isDragging])

  // Update colors when hovered or selected line changes
  useEffect(() => {
    if (!lineRef.current || !geometry || !lineData) return

    const colors = new Float32Array(lineData.colors.length)
    const originalColors = lineData.originalColors
    const segmentToLineMap = lineData.segmentToLineMap

    // Reset all colors to original
    for (let i = 0; i < colors.length; i++) {
      colors[i] = originalColors[i]
    }

    // Highlight the selected line (persistent, stronger highlight)
    if (selectedLineIndex !== null) {
      const selectedColor = new Color(1, 0, 1) // Magenta for selection

      for (let segmentIdx = 0; segmentIdx < segmentToLineMap.length; segmentIdx++) {
        if (segmentToLineMap[segmentIdx] === selectedLineIndex) {
          const colorStartIdx = segmentIdx * 6

          for (let i = 0; i < 6; i++) {
            if (i % 3 === 0) colors[colorStartIdx + i] = selectedColor.r
            else if (i % 3 === 1) colors[colorStartIdx + i] = selectedColor.g
            else colors[colorStartIdx + i] = selectedColor.b
          }
        }
      }
    }

    // Highlight the hovered line (temporary, lighter highlight)
    if (hoveredLineIndex !== null && hoveredLineIndex !== selectedLineIndex) {
      const hoverColor = new Color(1, 1, 0) // Yellow for hover

      for (let segmentIdx = 0; segmentIdx < segmentToLineMap.length; segmentIdx++) {
        if (segmentToLineMap[segmentIdx] === hoveredLineIndex) {
          const colorStartIdx = segmentIdx * 6

          for (let i = 0; i < 6; i++) {
            if (i % 3 === 0) colors[colorStartIdx + i] = hoverColor.r
            else if (i % 3 === 1) colors[colorStartIdx + i] = hoverColor.g
            else colors[colorStartIdx + i] = hoverColor.b
          }
        }
      }
    }

    // Update geometry colors
    geometry.setColors(colors)
  }, [hoveredLineIndex, selectedLineIndex, lineData, geometry])

  // Click handler for selection and point addition
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const start = performance.now()
      if (!lineRef.current || !lineData || isDragging) return

      // Convert mouse coordinates to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      // Update raycaster
      raycaster.setFromCamera(mouse, camera)
      raycaster.params.Line2 = { threshold: 20 }

      // Check for intersections with the line
      const intersects = raycaster.intersectObject(lineRef.current, false)

      if (intersects.length > 0) {
        const intersection = intersects[0]
        const segmentIndex = intersection.index !== undefined ? intersection.index : intersection.faceIndex

        if (segmentIndex !== undefined && segmentIndex >= 0 && segmentIndex < lineData.segmentToLineMap.length) {
          const lineIndex = lineData.segmentToLineMap[segmentIndex]

          if (selectedLineIndex === lineIndex) {
            // Line is already selected - add a point
            console.log(`Adding point to selected line ${lineIndex}`)
            const intersectionPoint = intersection.point
            addPointToLine(lineIndex, intersectionPoint)

            const debugInfo = `Added point to Line: ${lineIndex} | Points: ${lineData.linePoints[lineIndex].length + 1}`
            onDebugUpdate(debugInfo, hoveredLineIndex, lineIndex)
            setInteractionStats((prev: any) => ({ ...prev, addPoint: performance.now() - start }))
          } else {
            // Select the line and create spheres
            console.log(`Selected line ${lineIndex}`)
            setSelectedLineIndex(lineIndex)
            createSpheresForLine(lineIndex)

            const debugInfo = `Selected Line: ${lineIndex} | Points: ${lineData.linePoints[lineIndex]?.length || 0}`
            onDebugUpdate(debugInfo, hoveredLineIndex, lineIndex)
            setInteractionStats((prev: any) => ({ ...prev, select: performance.now() - start }))
          }
        }
      } else {
        // Clicked on empty space - deselect
        console.log("Clicked on empty space - deselecting")
        setSelectedLineIndex(null)
        removeSpheres()

        const debugInfo = `Deselected | Hover: ${hoveredLineIndex !== null ? hoveredLineIndex : "None"}`
        onDebugUpdate(debugInfo, hoveredLineIndex, null)
      }
    }

    gl.domElement.addEventListener("click", handleClick)
    return () => gl.domElement.removeEventListener("click", handleClick)
  }, [
    camera,
    gl,
    raycaster,
    mouse,
    hoveredLineIndex,
    selectedLineIndex,
    lineData,
    scene,
    onDebugUpdate,
    addPointToLine,
    createSpheresForLine,
    removeSpheres,
    isDragging,
  ])

  // Listen for delete line events from UI
  useEffect(() => {
    const handleDeleteLineEvent = (event: CustomEvent) => {
      const start = performance.now()
      const { lineIndex } = event.detail
      if (lineIndex === selectedLineIndex) {
        deleteLine(lineIndex)
        setSelectedLineIndex(null)
        onDebugUpdate(`Line ${lineIndex} deleted`, hoveredLineIndex, null)
        onLineDeleted?.(lineIndex)
        setInteractionStats((prev: any) => ({ ...prev, deleteLine: performance.now() - start }))
      }
    }

    window.addEventListener("deleteLine", handleDeleteLineEvent as EventListener)
    return () => {
      window.removeEventListener("deleteLine", handleDeleteLineEvent as EventListener)
    }
  }, [selectedLineIndex, deleteLine, onDebugUpdate, hoveredLineIndex, onLineDeleted])

  // Cleanup spheres on unmount
  useEffect(() => {
    return () => {
      removeSpheres()
    }
  }, [removeSpheres])

  // Update spheres when line data changes and a line is selected
  useEffect(() => {
    if (selectedLineIndex !== null && lineData) {
      createSpheresForLine(selectedLineIndex)
    }
  }, [lineData, selectedLineIndex, createSpheresForLine])

  if (!geometry || !material) return null

  return (
    <>
      <primitive ref={lineRef} object={new Line2(geometry, material)} />
      <OrbitControls
        ref={orbitControlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxDistance={500}
        minDistance={5}
      />
    </>
  )
}

interface InteractionStats {
  [key: string]: number | null
}

export default function Component() {
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null)
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null)
  const [mode, setMode] = useState<'A' | 'B'>('A')
  const [interactionStats, setInteractionStats] = useState<InteractionStats>({})
  const [performanceStats, setPerformanceStats] = useState({
    fps: 0,
    memory: 0,
    triangles: 0,
    points: 0,
    lines: 0,
    renderCalls: 0,
    drawCalls: 0,
    segments: 0,
    vertices: 0,
    gpuMemory: 0,
    cpuTime: 0,
    gpuTime: 0
  })
  const fpsHistory = useRef<number[]>([])
  const memoryHistory = useRef<number[]>([])
  const lastUpdateTime = useRef<number>(0)
  const statsRef = useRef<Stats | null>(null)
  const lastFrameTimeRef = useRef<number>(0)

  useEffect(() => {
    statsRef.current = new Stats()
    statsRef.current.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(statsRef.current.dom)

    // Position stats panel to the top right
    statsRef.current.dom.style.position = 'absolute'
    statsRef.current.dom.style.top = '10px'
    statsRef.current.dom.style.right = '10px'
    statsRef.current.dom.style.bottom = 'auto'
    statsRef.current.dom.style.left = 'auto'
    statsRef.current.dom.style.zIndex = '1000'
    statsRef.current.dom.style.opacity = '0.9'
    statsRef.current.dom.style.pointerEvents = 'auto'
    statsRef.current.dom.style.display = 'block'



    const animate = () => {
      if (statsRef.current) {
        statsRef.current.begin()
        statsRef.current.end()
        
        // Update performance stats using stats.js internal data
        const currentTime = performance.now()
        let fps = 0
        let memory = 0
        
        // Get FPS from stats.js internal data
        if (statsRef.current && (statsRef.current as any).dom) {
          // Try to get FPS from the stats panel - look for the FPS text
          const allText = statsRef.current.dom.textContent || ''
          
          // Look for FPS pattern - stats.js usually shows "60 FPS" or similar
          const fpsMatch = allText.match(/(\d+)\s*FPS|FPS:\s*(\d+)/i)
          if (fpsMatch) {
            fps = parseInt(fpsMatch[1] || fpsMatch[2])
          }
          
          // If no FPS found, try to get the first number (usually FPS)
          if (fps === 0) {
            const numbers = allText.match(/\d+/g)
            if (numbers && numbers.length > 0) {
              const potentialFps = parseInt(numbers[0])
              if (potentialFps > 0 && potentialFps <= 200) { // Reasonable FPS range
                fps = potentialFps
              }
            }
          }
          
          // Get memory from stats.js - look for MB pattern
          const memoryMatch = allText.match(/(\d+)\s*MB|MB:\s*(\d+)/i)
          if (memoryMatch) {
            memory = parseInt(memoryMatch[1] || memoryMatch[2])
          }
        }
        
        // Fallback to performance.memory if stats.js doesn't have memory data
        if (memory === 0 && performance.memory) {
          memory = Math.round(performance.memory.usedJSHeapSize / 1048576)
        }
        
        // Fallback FPS calculation if stats.js doesn't provide it
        if (fps === 0 && lastFrameTimeRef.current > 0) {
          const deltaTime = currentTime - lastFrameTimeRef.current
          fps = Math.round(1000 / deltaTime)
        }
        
        // Smooth FPS and memory values to reduce glitching
        if (fps > 0) {
          fpsHistory.current.push(fps)
          if (fpsHistory.current.length > 30) { // Increased from 10 to 30 for more smoothing
            fpsHistory.current.shift()
          }
          fps = Math.round(fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length)
        }
        
        if (memory > 0) {
          memoryHistory.current.push(memory)
          if (memoryHistory.current.length > 15) { // Increased from 5 to 15 for more smoothing
            memoryHistory.current.shift()
          }
          memory = Math.round(memoryHistory.current.reduce((a, b) => a + b, 0) / memoryHistory.current.length)
        }
        
        // Only update stats every 1000ms (1 second) to reduce glitching
        if (currentTime - lastUpdateTime.current > 1000) {
          setPerformanceStats(prev => ({
            ...prev,
            fps: fps,
            memory: memory
          }))
          lastUpdateTime.current = currentTime
        }
        
        lastFrameTimeRef.current = currentTime
      }
      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)

    return () => {
      if (statsRef.current) {
        document.body.removeChild(statsRef.current.dom)
      }
    }
  }, [])

  const handleDebugUpdate = (info: string, hoveredLine: number | null, selectedLine: number | null) => {
    setDebugInfo(info)
    setHoveredLineIndex(hoveredLine)
    setSelectedLineIndex(selectedLine)
  }

  const handleDeleteLine = () => {
    if (selectedLineIndex !== null) {
      // This will be handled by the DisconnectedLines component
      const event = new CustomEvent("deleteLine", { detail: { lineIndex: selectedLineIndex } })
      window.dispatchEvent(event)
    }
  }

  return (
    <div className="w-full h-screen bg-black">
      <Canvas camera={{ position: [50, 50, 50], fov: 75 }}>
        <color attach="background" args={["#000000"]} />

        {/* Enhanced lighting for spheres */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        <pointLight position={[10, -10, 10]} intensity={0.3} />

        {/* The main lines component */}
        {mode === 'A' ? (
          <DisconnectedLines 
            onDebugUpdate={handleDebugUpdate} 
            onLineDeleted={(lineIndex) => {
              setSelectedLineIndex(null)
              setDebugInfo(`Line ${lineIndex} deleted`)
            }}
            setInteractionStats={setInteractionStats}
            setPerformanceStats={setPerformanceStats}
          />
        ) : (
          <DisconnectedLinesMultiple 
            onDebugUpdate={handleDebugUpdate} 
            onLineDeleted={(lineIndex) => {
              setSelectedLineIndex(null)
              setDebugInfo(`Line ${lineIndex} deleted`)
              setInteractionStats((prev) => ({ ...prev, deleteLine: performance.now() - (prev.deleteLine_start || 0) }))
            }}
            setInteractionStats={setInteractionStats}
            setPerformanceStats={setPerformanceStats}
          />
        )}
      </Canvas>

      {/* Info overlay */}
      <div className="absolute top-6 left-6 text-white bg-black/90 p-6 rounded-xl border border-gray-600 shadow-2xl" style={{
        backdropFilter: 'blur(10px)',
        maxWidth: '380px'
      }}>
        <h2 className="text-2xl font-bold mb-4 text-blue-400 border-b border-gray-600 pb-3">Line2 Performance Comparison</h2>
        <div className="space-y-2 text-sm mb-6">
          <p className="text-gray-300">5000 interactive lines</p>
          <p className="text-gray-300">Performance comparison tool</p>
          <p className="text-gray-300">Real-time metrics & analysis</p>
        </div>
        
        <div className="space-y-3 mb-6">
          <p className="text-sm text-yellow-400">🎯 Hover: Yellow highlight</p>
          <p className="text-sm text-purple-400">🎯 Click: Magenta selection + white spheres</p>
          <p className="text-sm text-green-400">🎯 Click selected line: Add green point</p>
          <p className="text-sm text-blue-400">🖱️ Drag spheres: Move points</p>
          <p className="text-sm text-orange-400">🗑️ Right-click sphere: Delete point</p>
          <p className="text-sm text-gray-300">Click empty space to deselect</p>
        </div>
        
        <div>
          <h3 className="text-lg font-bold mb-4 text-blue-400">Rendering Mode</h3>
          <div className="flex flex-col space-y-2">
            <Button 
              onClick={() => setMode('A')} 
              variant={mode === 'A' ? "default" : "outline"} 
              className={`${mode === 'A' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'} border-gray-600 font-semibold shadow-lg px-3 py-2 text-sm`}
            >
              Disconnected Lines - Single Line2 Object
            </Button>
            <Button 
              onClick={() => setMode('B')} 
              variant={mode === 'B' ? "default" : "outline"} 
              className={`${mode === 'B' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'} border-gray-600 font-semibold shadow-lg px-3 py-2 text-sm`}
            >
              Multiple Line2 Objects
            </Button>
          </div>
        </div>
      </div>

      {/* Control panel */}
      {selectedLineIndex !== null && (
        <div className="absolute top-6 right-6 bg-black/90 p-6 rounded-xl border border-gray-600 shadow-2xl" style={{
          backdropFilter: 'blur(10px)',
          minWidth: '200px',
          zIndex: '1002',
          top: '90px' // Position below the stats.js panel
        }}>
          <h3 className="text-white text-lg font-bold mb-4 text-blue-400 border-b border-gray-600 pb-3">Line Controls</h3>
          <p className="text-white text-sm mb-4 bg-gray-800/50 p-3 rounded-lg">Selected Line: <span className="text-purple-400 font-bold">{selectedLineIndex}</span></p>
          <Button onClick={handleDeleteLine} variant="destructive" size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg py-2">
            🗑️ Delete Line
          </Button>
        </div>
      )}

      {/* Performance Stats */}
      <div className="absolute bottom-4 right-4 bg-black/90 p-4 rounded-lg border border-gray-600 shadow-xl" style={{ 
        bottom: '16px',
        right: '16px',
        minWidth: '200px',
        maxWidth: '220px',
        backdropFilter: 'blur(10px)',
        zIndex: '1001'
      }}>
        <h3 className="text-white text-sm font-bold mb-3 text-blue-400 border-b border-gray-600 pb-2">Performance</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">FPS:</span>
            <span className="text-green-400 font-mono font-bold">{performanceStats.fps}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Memory:</span>
            <span className="text-blue-400 font-mono">{performanceStats.memory} MB</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Lines:</span>
            <span className="text-orange-400 font-mono">{performanceStats.lines.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Render Calls:</span>
            <span className="text-pink-400 font-mono">{performanceStats.renderCalls}</span>
          </div>
        </div>
      </div>

      {/* Debug and Stats info overlay */}
      <div className="absolute bottom-6 left-6 text-white bg-black/90 p-6 rounded-xl border border-gray-600 shadow-2xl" style={{
        backdropFilter: 'blur(10px)',
        maxWidth: '420px'
      }}>
        <h3 className="text-lg font-bold mb-4 text-blue-400 border-b border-gray-600 pb-3">Debug Info</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p className="break-words bg-gray-800/50 p-2 rounded">{debugInfo || "Hover and click on lines"}</p>
          <div className="flex justify-between items-center">
            <span>Hovered:</span>
            <span className="text-yellow-400 font-mono font-bold">{hoveredLineIndex !== null ? hoveredLineIndex : "None"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Selected:</span>
            <span className="text-purple-400 font-mono font-bold">{selectedLineIndex !== null ? selectedLineIndex : "None"}</span>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-600">
          <h4 className="font-bold mb-2 text-blue-400">Interaction Stats (ms)</h4>
          <div className="space-y-1 text-xs font-mono">
            {Object.entries(interactionStats).map(([name, value]) => (
              <p key={name} className="flex justify-between">
                <span className="text-gray-300">{name.replace("hover", "raycaster").replace("_", " ")}:</span>
                <span className="text-green-400">{value?.toFixed(4) ?? 'N/A'}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
