// Solo las piezas de three.js que usa el mundo de bloques (blocks.js), para que el archivo pese poco.
export {
  WebGLRenderer, Scene, PerspectiveCamera, Fog, Color, Vector3, Group, Mesh, Points, LineSegments,
  BufferGeometry, BufferAttribute, BoxGeometry, PlaneGeometry, SphereGeometry, EdgesGeometry,
  MeshBasicMaterial, MeshLambertMaterial, PointsMaterial, LineBasicMaterial,
  CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, DoubleSide,
  HemisphereLight, DirectionalLight,
} from "three";
