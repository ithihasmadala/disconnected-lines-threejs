declare module 'three/examples/jsm/lines/Line2.js' {
  import { LineSegments2 } from 'three';
  import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
  import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
  
  export class Line2 extends LineSegments2 {
    constructor(geometry?: LineSegmentsGeometry, material?: LineMaterial);
  }
}

declare module 'three/examples/jsm/lines/LineMaterial.js' {
  import { Material, MaterialParameters } from 'three';
  
  export interface LineMaterialParameters extends MaterialParameters {
    vertexColors?: boolean;
    linewidth?: number;
    resolution?: [number, number];
  }
  
  export class LineMaterial extends Material {
    constructor(parameters?: LineMaterialParameters);
    vertexColors: boolean;
    linewidth: number;
    resolution: [number, number];
  }
}

declare module 'three/examples/jsm/lines/LineSegmentsGeometry.js' {
  import { BufferGeometry } from 'three';
  
  export class LineSegmentsGeometry extends BufferGeometry {
    setPositions(positions: Float32Array | number[]): this;
    setColors(colors: Float32Array | number[]): this;
  }
}

declare module 'three/examples/jsm/lines/LineGeometry.js' {
  import { BufferGeometry } from 'three';
  
  export class LineGeometry extends BufferGeometry {
    setPositions(positions: Float32Array | number[]): this;
    setColors(colors: Float32Array | number[]): this;
  }
}

// Extend Performance interface to include memory
interface Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
} 