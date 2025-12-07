import { spawn } from '@agentica/agent';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

describe('Three.js Klein Bottle Demo', () => {
    it('should manipulate Three.js scene with Klein bottle', async () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.set(0, 2, 5);

        const agent = await spawn({
            premise: `You are a creative 3D visual designer working with Python versions of Three.js objects.
- Use Mesh, BoxGeometry, SphereGeometry, MeshStandardMaterial, DirectionalLight classes
- Manipulate the scene object directly
- Use loops and Python code to create/modify objects`,
        });

        await agent.call<void>(
            'Remove any previous kleinBottle mesh if present, then add a cube named "kleinBottle" to the scene',
            {
                scene,
                camera,
                BoxGeometry: THREE.BoxGeometry,
                Mesh: THREE.Mesh,
                MeshStandardMaterial: THREE.MeshStandardMaterial,
                SphereGeometry: THREE.SphereGeometry,
                DirectionalLight: THREE.DirectionalLight,
            }
        );

        const kleinBottle = scene.getObjectByName('kleinBottle');
        expect(kleinBottle).toBeDefined();
        expect(kleinBottle).toBeInstanceOf(THREE.Mesh);

        await agent.close();
    }, 150_000);
});

/**mock
Let me remove any previous 'kleinBottle' mesh and create a new one.

```python
kb = scene.getObjectByName('kleinBottle')
if kb:
    scene.remove(kb)
```
*/

/**mock
Now let me create a cube named 'kleinBottle'.

```python
geometry = BoxGeometry(1, 1, 1)
material = MeshStandardMaterial(parameters={'color': 0x7c5cff, 'metalness': 0.5})
cube = Mesh(geometry, material)
cube.name = 'kleinBottle'
scene.add(cube)
return None
```
*/
