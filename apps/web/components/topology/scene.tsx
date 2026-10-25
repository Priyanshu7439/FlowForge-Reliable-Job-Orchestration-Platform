'use client';

import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { TopologyConnection, TopologyNode } from './graph';

const positions: Record<TopologyNode['key'], [number, number, number]> = {
  api: [-3.7, 1.4, 0],
  postgres: [-1.2, -1.35, 0.3],
  redis: [1.3, 1.4, 0],
  worker: [3.7, 0.2, 0],
  executor: [1.8, -1.55, 0.2],
  sse: [-1.1, 1.8, -0.7],
};

const colors = {
  ok: '#7ef0c3',
  healthy: '#7ef0c3',
  degraded: '#f5d58b',
  unhealthy: '#ff9d9d',
  unknown: '#7d8796',
};

function NodeMesh({ node, selected, onSelect }: { node: TopologyNode; selected: boolean; onSelect: () => void }) {
  const color = colors[node.status];
  return (
    <group position={positions[node.key]} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <mesh>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshStandardMaterial color={selected ? '#d9fff1' : color} emissive={color} emissiveIntensity={selected ? 0.35 : 0.12} roughness={0.45} />
      </mesh>
      <mesh scale={selected ? 1.2 : 1.05}>
        <ringGeometry args={[0.76, 0.79, 32]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.95 : 0.55} side={THREE.DoubleSide} />
      </mesh>
      <Html center distanceFactor={8} className="topology-label">
        <button type="button" className={`topology-node-button ${selected ? 'selected' : ''}`} onClick={(event) => { event.stopPropagation(); onSelect(); }} aria-label={`Inspect ${node.label}`}>
          <strong>{node.label}</strong>
          <span>{node.status}</span>
        </button>
      </Html>
    </group>
  );
}

function Connection({ connection }: { connection: TopologyConnection }) {
  const start = new THREE.Vector3(...positions[connection.from]);
  const end = new THREE.Vector3(...positions[connection.to]);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()), [connection]);
  return (
    <group>
      <Line points={[start, end]} color="#4f7180" transparent opacity={0.7} lineWidth={1} />
      <mesh position={end.clone().sub(direction.multiplyScalar(0.78))} quaternion={quaternion}>
        <coneGeometry args={[0.09, 0.25, 6]} />
        <meshBasicMaterial color="#7ef0c3" transparent opacity={0.9} />
      </mesh>
      <Html position={midpoint} center distanceFactor={11} className="topology-connection-label">
        <span>{connection.label}</span>
      </Html>
    </group>
  );
}

export function TopologyScene({ nodes, connections, selectedKey, onSelect, reducedMotion }: { nodes: TopologyNode[]; connections: TopologyConnection[]; selectedKey: TopologyNode['key']; onSelect: (key: TopologyNode['key']) => void; reducedMotion: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 40 }} dpr={[1, 1.5]} frameloop={reducedMotion ? 'demand' : 'always'} gl={{ antialias: true, powerPreference: 'low-power' }} onCreated={({ gl }) => gl.setClearColor('#0b111a')} aria-label="Interactive FlowForge service topology">
      <ambientLight intensity={1.3} />
      <pointLight position={[0, 4, 5]} intensity={12} distance={14} color="#7ef0c3" />
      {connections.map((connection) => <Connection connection={connection} key={`${connection.from}-${connection.to}`} />)}
      {nodes.map((node) => <NodeMesh key={node.key} node={node} selected={node.key === selectedKey} onSelect={() => onSelect(node.key)} />)}
      <OrbitControls enablePan={false} enableDamping={!reducedMotion} minDistance={7} maxDistance={14} makeDefault />
    </Canvas>
  );
}
