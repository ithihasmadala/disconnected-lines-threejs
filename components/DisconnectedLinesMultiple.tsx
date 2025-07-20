"use client"

import { useRef, useMemo, useEffect, useState, useCallback } from "react"
import { useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Line2 } from "three/examples/jsm/lines/Line2.js"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js"
import { Color, Raycaster, Vector2, SphereGeometry, MeshStandardMaterial, Mesh, Vector3, Plane } from "three"

interface LineData {
  line: Line2
  points: [number, number, number][]
  color: Color
}

interface DisconnectedLinesMultipleProps {
  onDebugUpdate: (info: string, hoveredLine: number | null, selectedLine: number | null) => void
  onLineDeleted?: (lineIndex: number) => void
  setInteractionStats: (stats: any) => void
  setPerformanceStats: (stats: any) => void
}

function DisconnectedLinesMultiple({ onDebugUpdate, onLineDeleted, setInteractionStats, setPerformanceStats }: DisconnectedLinesMultipleProps) {
  const [lines, setLines] = useState<LineData[]>([])
  const spheresRef = useRef<Mesh[]>([])
  const orbitControlsRef = useRef<any>(null)
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null)
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null)
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

  const removeSpheres = useCallback(() => {
    spheresRef.current.forEach(sphere => {
      scene.remove(sphere)
      sphere.geometry.dispose()
      if (Array.isArray(sphere.material)) {
        sphere.material.forEach(mat => mat.dispose())
      } else {
        sphere.material.dispose()
      }
    })
    spheresRef.current = []
  }, [scene])

  const createSpheresForLine = useCallback(
    (lineIndex: number) => {
      removeSpheres()
      const lineData = lines[lineIndex]
      if (!lineData) return

      const sphereGeometry = new SphereGeometry(1, 8, 6)
      const sphereMaterial = new MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x444444,
      })

      const newSpheres: Mesh[] = []
      lineData.points.forEach((point, index) => {
        const sphere = new Mesh(sphereGeometry, sphereMaterial)
        sphere.position.set(point[0], point[1], point[2])
        sphere.userData = { lineIndex, pointIndex: index }
        scene.add(sphere)
        newSpheres.push(sphere)
      })
      spheresRef.current = newSpheres
    },
    [lines, scene, removeSpheres],
  )

  useEffect(() => {
    console.time("Mode B Initial Load")
    const numLines = 5000
    const pointsPerLine = 50
    const gridSize = Math.ceil(Math.pow(numLines, 1 / 3))
    const spacing = 30

    const newLines: LineData[] = []

    for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
      const gridX = lineIndex % gridSize
      const gridY = Math.floor(lineIndex / gridSize) % gridSize
      const gridZ = Math.floor(lineIndex / (gridSize * gridSize))

      const centerX = (gridX - gridSize / 2) * spacing
      const centerY = (gridY - gridSize / 2) * spacing
      const centerZ = (gridZ - gridSize / 2) * spacing

      const hue = (lineIndex / numLines) * 360
      const color = new Color().setHSL(hue / 360, 0.8, 0.6)

      const currentLinePoints: [number, number, number][] = []
      const localRange = 12

      for (let pointIndex = 0; pointIndex < pointsPerLine; pointIndex++) {
        const x = centerX + (Math.random() - 0.5) * localRange
        const y = centerY + (Math.random() - 0.5) * localRange
        const z = centerZ + (Math.random() - 0.5) * localRange
        currentLinePoints.push([x, y, z])
      }

      const positions = new Float32Array(currentLinePoints.flat())
      const geometry = new LineGeometry()
      geometry.setPositions(positions)

      const material = new LineMaterial({
        color: color.getHex(),
        linewidth: 5,
        resolution: [window.innerWidth, window.innerHeight],
      })

      const line = new Line2(geometry, material)
      line.userData = { lineIndex }
      newLines.push({ line, points: currentLinePoints, color })
    }

    setLines(newLines)
    console.timeEnd("Mode B Initial Load")
  }, [])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const start = performance.now()
      const rect = gl.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      if (isDragging && draggedSphere) {
        const intersectionPoint = new Vector3()
        if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
          draggedSphere.position.copy(intersectionPoint)
          const { lineIndex, pointIndex } = draggedSphere.userData
          const newLines = [...lines]
          newLines[lineIndex].points[pointIndex] = [intersectionPoint.x, intersectionPoint.y, intersectionPoint.z]
          const positions = new Float32Array(newLines[lineIndex].points.flat())
          const geometry = newLines[lineIndex].line.geometry as LineGeometry
          geometry.setPositions(positions)
          setLines(newLines)
        }
        setInteractionStats((prev: any) => ({ ...prev, drag: performance.now() - start }))
      } else {
        const intersects = raycaster.intersectObjects(lines.map(l => l.line), false)
        if (intersects.length > 0) {
          const intersectedLine = intersects[0].object as Line2
          const lineIndex = intersectedLine.userData.lineIndex
          const debugInfo = `Hover - Line: ${lineIndex} | Selected: ${selectedLineIndex !== null ? selectedLineIndex : "None"}`
          onDebugUpdate(debugInfo, lineIndex, selectedLineIndex)
          if (hoveredLineIndex !== lineIndex) {
            setHoveredLineIndex(lineIndex)
          }
        } else {
          const debugInfo = `No hover | Selected: ${selectedLineIndex !== null ? selectedLineIndex : "None"}`
          onDebugUpdate(debugInfo, null, selectedLineIndex)
          if (hoveredLineIndex !== null) {
            setHoveredLineIndex(null)
          }
        }
        setInteractionStats((prev: any) => ({ ...prev, hover: performance.now() - start }))
      }
    }

    gl.domElement.addEventListener("mousemove", handleMouseMove)
    return () => gl.domElement.removeEventListener("mousemove", handleMouseMove)
  }, [camera, gl, raycaster, mouse, lines, hoveredLineIndex, isDragging, draggedSphere, dragPlane])

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (selectedLineIndex === null || event.button !== 0) return

      const rect = gl.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      const sphereIntersects = raycaster.intersectObjects(spheresRef.current, false)
      if (sphereIntersects.length > 0) {
        const intersectedSphere = sphereIntersects[0].object as Mesh
        setIsDragging(true)
        setDraggedSphere(intersectedSphere)
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = false
        }
        const cameraDirection = new Vector3()
        camera.getWorldDirection(cameraDirection)
        dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, intersectedSphere.position)
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        setDraggedSphere(null)
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = true
        }
      }
    }

    const handleClick = (event: MouseEvent) => {
      const start = performance.now()
      if (isDragging) return

      const rect = gl.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      const intersects = raycaster.intersectObjects(lines.map(l => l.line), false)
      if (intersects.length > 0) {
        const intersect = intersects[0]
        const intersectedLine = intersect.object as Line2
        const lineIndex = intersectedLine.userData.lineIndex

        if (selectedLineIndex === lineIndex) {
          const newLines = [...lines]
          const lineData = newLines[lineIndex]
          const newPoints = [...lineData.points]
          const intersectionPoint = intersect.point
          let closestSegmentIndex = 0
          let minDistance = Number.POSITIVE_INFINITY
          for (let i = 0; i < newPoints.length - 1; i++) {
            const p1 = new Vector3().fromArray(newPoints[i])
            const p2 = new Vector3().fromArray(newPoints[i + 1])
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
          newPoints.splice(closestSegmentIndex + 1, 0, [intersectionPoint.x, intersectionPoint.y, intersectionPoint.z])
          lineData.points = newPoints
          const positions = new Float32Array(newPoints.flat())
          const geometry = lineData.line.geometry as LineGeometry
          geometry.setPositions(positions)
          setLines(newLines)
          createSpheresForLine(lineIndex)
          const debugInfo = `Added point to Line: ${lineIndex} | Points: ${newLines[lineIndex].points.length}`
          onDebugUpdate(debugInfo, hoveredLineIndex, lineIndex)
          setInteractionStats((prev: any) => ({ ...prev, addPoint: performance.now() - start }))
        } else {
          setSelectedLineIndex(lineIndex)
          createSpheresForLine(lineIndex)
          const debugInfo = `Selected Line: ${lineIndex} | Points: ${lines[lineIndex].points.length}`
          onDebugUpdate(debugInfo, hoveredLineIndex, lineIndex)
          setInteractionStats((prev: any) => ({ ...prev, select: performance.now() - start }))
        }
      } else {
        setSelectedLineIndex(null)
        removeSpheres()
        const debugInfo = `Deselected | Hover: ${hoveredLineIndex !== null ? hoveredLineIndex : "None"}`
        onDebugUpdate(debugInfo, hoveredLineIndex, null)
      }
    }

    const handleContextMenu = (event: MouseEvent) => {
      const start = performance.now()
      event.preventDefault()
      if (selectedLineIndex === null) return

      const rect = gl.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      const sphereIntersects = raycaster.intersectObjects(spheresRef.current, false)
      if (sphereIntersects.length > 0) {
        const intersectedSphere = sphereIntersects[0].object as Mesh
        const { lineIndex, pointIndex } = intersectedSphere.userData
        if (lineIndex === selectedLineIndex) {
          const newLines = [...lines]
          const lineData = newLines[lineIndex]
          if (lineData.points.length > 2) {
            lineData.points.splice(pointIndex, 1)
            const positions = new Float32Array(lineData.points.flat())
            const geometry = lineData.line.geometry as LineGeometry
            geometry.setPositions(positions)
            setLines(newLines)
            createSpheresForLine(lineIndex)
            const debugInfo = `Deleted point ${pointIndex} from line ${lineIndex}`
            onDebugUpdate(debugInfo, hoveredLineIndex, selectedLineIndex)
            setInteractionStats((prev: any) => ({ ...prev, deletePoint: performance.now() - start }))
          }
        }
      }
    }

    gl.domElement.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)
    gl.domElement.addEventListener("click", handleClick)
    gl.domElement.addEventListener("contextmenu", handleContextMenu)

    return () => {
      gl.domElement.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
      gl.domElement.removeEventListener("click", handleClick)
      gl.domElement.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [camera, gl, raycaster, mouse, lines, selectedLineIndex, isDragging, draggedSphere, dragPlane, createSpheresForLine, removeSpheres])

  useEffect(() => {
    const handleDeleteLineEvent = (event: CustomEvent) => {
      const { lineIndex } = event.detail
      if (lineIndex === selectedLineIndex) {
        setInteractionStats((prev: any) => ({ ...prev, deleteLine_start: performance.now() }))
        const newLines = [...lines]
        const lineData = newLines[lineIndex]
        scene.remove(lineData.line)
        lineData.line.geometry.dispose()
        if (Array.isArray(lineData.line.material)) {
          lineData.line.material.forEach(mat => mat.dispose())
        } else {
          lineData.line.material.dispose()
        }
        newLines.splice(lineIndex, 1)
        setLines(newLines)
        setSelectedLineIndex(null)
        removeSpheres()
        onLineDeleted?.(lineIndex)
      }
    }

    window.addEventListener("deleteLine", handleDeleteLineEvent as EventListener)
    return () => {
      window.removeEventListener("deleteLine", handleDeleteLineEvent as EventListener)
    }
  }, [selectedLineIndex, lines, scene, removeSpheres, onLineDeleted, setInteractionStats])

  useEffect(() => {
    lines.forEach((lineData, index) => {
      const material = lineData.line.material as LineMaterial
      if (index === selectedLineIndex) {
        material.color = new Color(1, 0, 1) // Magenta for selection
      } else if (index === hoveredLineIndex) {
        material.color = new Color(1, 1, 0) // Yellow for hover
      } else {
        material.color = lineData.color
      }
    })
  }, [hoveredLineIndex, selectedLineIndex, lines])

  return (
    <>
      {lines.map((lineData, index) => (
        <primitive key={index} object={lineData.line} />
      ))}
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

export default DisconnectedLinesMultiple