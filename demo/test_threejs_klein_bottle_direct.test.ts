import { spawn } from '@agentica/agent';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

describe('Three.js Klein Bottle Direct Execution', () => {
    it('should create Klein bottle using BufferGeometry', async () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.set(0, 2, 5);

        const agent = await spawn({
            premise: `You are a creative 3D visual designer working with Python versions of Three.js objects.
- Use Mesh, BoxGeometry, SphereGeometry, MeshStandardMaterial, DirectionalLight classes
- Use BufferGeometry and createAttribute for custom meshes
- Manipulate the scene object directly
- Use loops and Python code to create/modify objects`,
        });

        const createTypedArray = (array: number[], type: 'float32' | 'uint32' = 'float32') => {
            return type === 'uint32' ? new Uint32Array(array) : new Float32Array(array);
        };

        await agent.call<void>(
            'Create a Klein bottle mesh named "klein_bottle" using BufferGeometry with proper parametric equations',
            {
                scene,
                camera,
                BoxGeometry: THREE.BoxGeometry,
                Mesh: THREE.Mesh,
                MeshStandardMaterial: THREE.MeshStandardMaterial,
                SphereGeometry: THREE.SphereGeometry,
                DirectionalLight: THREE.DirectionalLight,
                BufferGeometry: THREE.BufferGeometry,
                BufferAttribute: THREE.BufferAttribute,
                createTypedArray: createTypedArray,
                Vector3: THREE.Vector3,
            }
        );

        const kleinBottle = scene.getObjectByName('klein_bottle');
        expect(kleinBottle).toBeDefined();
        expect(kleinBottle).toBeInstanceOf(THREE.Mesh);

        // Verify geometry has vertices
        const mesh = kleinBottle as THREE.Mesh;
        const geometry = mesh.geometry as THREE.BufferGeometry;
        const positionAttr = geometry.getAttribute('position');
        expect(positionAttr).toBeDefined();
        expect(positionAttr.count).toBeGreaterThan(0);

        await agent.close();
    }, 60_000);
});

/**mock
I'll create a Klein bottle using BufferGeometry with parametric equations.

```python
import math

# Remove any previous Klein bottle
for obj in list(getattr(scene, 'children', [])):
    if getattr(obj, 'name', '') == "klein_bottle":
        scene.remove(obj)

# Klein bottle parameters
u_segs, v_segs = 100, 100
vertices = []
indices = []

for i in range(u_segs + 1):
    u = (i / u_segs) * 2 * math.pi
    for j in range(v_segs + 1):
        v = (j / v_segs) * 2 * math.pi

        # Standard Klein bottle parametric equations (inset mesh, readable form)
        # x, y, z are defined for a classic closed Klein bottle

        if 0 <= u < math.pi:
            x = 3 * math.cos(u) * (1 + math.sin(u)) + \
                2 * (1 - math.cos(u)/2) * math.cos(u) * math.cos(v)
            z = -8 * math.sin(u) - 2 * (1 - math.cos(u)/2) * math.sin(u) * math.cos(v)
        else:
            x = 3 * math.cos(u) * (1 + math.sin(u)) + \
                2 * (1 - math.cos(u)/2) * math.cos(v + math.pi)
            z = -8 * math.sin(u)
        y = -2 * (1 - math.cos(u)/2) * math.sin(v)

        # Scaling down for usual scene size
        vertices.extend([x*0.12, y*0.12, z*0.12])

# Build indices for triangles
for i in range(u_segs):
    for j in range(v_segs):
        a = i * (v_segs + 1) + j
        b = a + v_segs + 1

        indices.extend([a, b, a+1, b, b+1, a+1])

geometry = BufferGeometry()
geometry.setAttribute('position', BufferAttribute(createTypedArray(vertices, 'float32'), 3))
geometry.setIndex(BufferAttribute(createTypedArray(indices, 'uint32'), 1))
geometry.computeVertexNormals()

material = MeshStandardMaterial(parameters={
    'color': 0x7c5cff,
    'metalness': 0.35,
    'roughness': 0.62,
    'side': 2
})

klein_bottle = Mesh(geometry, material)
klein_bottle.name = "klein_bottle"
scene.add(klein_bottle)

# Give a nice view of the object
camera.position.set(3.5, 3, 3.5)
camera.lookAt(Vector3(0, 0, 0))

# Add a light for PBR shading
if not any(isinstance(obj, DirectionalLight) for obj in getattr(scene, 'children', [])):
    light = DirectionalLight(0xffffff, 1.1)
    light.position.set(6, 10, 6)
    scene.add(light)

return None
```
*/
