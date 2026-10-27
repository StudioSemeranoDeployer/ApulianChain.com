/* ==========================================================================
   ApulianChain — Atlante Luminoso
   A small, self-contained Three.js scene: the hand-drawn Puglia silhouette
   becomes a dark glass atlas with galaxy top, seven living hubs, travelling
   ledger blocks and a compass ring. GSAP handles the entrance; pointer and
   scroll handling stay local and passive.

   The module is loaded only on the homepage. It exits early when the viewer
   prefers reduced motion, when WebGL2 is unavailable, or when the stage is
   missing, leaving the static artwork in place.
   ========================================================================== */

const stage = document.querySelector('[data-hero-stage]');

if (stage) {
    boot(stage);
}

function boot(stage) {
    const mount = stage.querySelector('[data-stage-canvas]');
    if (!mount) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    if (!supportsWebGL2()) return;

    stage.classList.add('is-loading');

    Promise.all([
        import('three'),
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/environments/RoomEnvironment.js'),
        loadJSON(new URL('../data/puglia-shape.json', import.meta.url)),
        loadJSON(new URL('../data/network.json', import.meta.url)),
        loadTexture('../../img/opt/puglia-texture.webp', import.meta.url)
    ])
        .then(([THREE, composerMod, renderMod, bloomMod, outputMod, roomMod, shape, hubs, texture]) => {
            initScene({
                THREE,
                stage,
                mount,
                textureImage: texture,
                shape,
                hubs,
                EffectComposer: composerMod.EffectComposer,
                RenderPass: renderMod.RenderPass,
                UnrealBloomPass: bloomMod.UnrealBloomPass,
                OutputPass: outputMod.OutputPass,
                RoomEnvironment: roomMod.RoomEnvironment
            });
        })
        .catch((error) => {
            console.warn('[Atlante] 3D stage unavailable, keeping static artwork.', error);
            stage.classList.remove('is-loading');
            stage.classList.add('is-fallback');
        });
}

/* ---------- helpers ------------------------------------------------------- */

function supportsWebGL2() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (!gl) return false;
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        return true;
    } catch (error) {
        return false;
    }
}

function loadJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then((response) => {
        if (!response.ok) throw new Error(`JSON ${response.status}: ${url}`);
        return response.json();
    });
}

function loadTexture(path, base) {
    const url = new URL(path, base).href;
    return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => {
            console.warn('[Atlante] texture unavailable, using flat atlas surface.', url);
            resolve(null);
        };
        image.src = url;
    });
}

function makeGlowTexture(THREE, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.34)') {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.28, mid);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function makeRadialTexture(THREE, stops) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/* ---------- scene --------------------------------------------------------- */

function initScene(options) {
    const {
        THREE,
        stage,
        mount,
        textureImage,
        shape,
        hubs,
        EffectComposer,
        RenderPass,
        UnrealBloomPass,
        OutputPass,
        RoomEnvironment
    } = options;

    const size = () => {
        const rect = stage.getBoundingClientRect();
        return {
            width: Math.max(1, rect.width),
            height: Math.max(1, rect.height)
        };
    };

    const initial = size();
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initial.width, initial.height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, initial.width / initial.height, 0.1, 100);
    camera.position.set(0, 3.05, 3.6);
    camera.lookAt(0, 0.02, 0);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    scene.add(new THREE.AmbientLight(0xa9c8ff, 0.5));

    const keyLight = new THREE.DirectionalLight(0x8fd6ff, 2.4);
    keyLight.position.set(3.4, 5.2, 2.4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 1.7);
    rimLight.position.set(-4.2, 2.4, -3.2);
    scene.add(rimLight);

    const warmLight = new THREE.PointLight(0xf1c987, 9, 8, 2);
    warmLight.position.set(0.2, 2.6, 0.4);
    scene.add(warmLight);

    const introGroup = new THREE.Group();
    scene.add(introGroup);

    const tiltGroup = new THREE.Group();
    introGroup.add(tiltGroup);

    const constellation = new THREE.Group();
    scene.add(constellation);

    const W = 2.52;
    const H = W / (shape.aspect || 1.337);
    const points = shape.points.map(([u, v]) => new THREE.Vector2((u - 0.5) * W, (0.5 - v) * H));
    const pugliaShape = new THREE.Shape(points);

    const bodyGeometry = new THREE.ExtrudeGeometry(pugliaShape, {
        steps: 1,
        depth: 0.15,
        bevelEnabled: true,
        bevelThickness: 0.014,
        bevelSize: 0.014,
        bevelSegments: 3,
        curveSegments: 1
    });
    bodyGeometry.rotateX(-Math.PI / 2);
    bodyGeometry.computeBoundingBox();
    const topY = bodyGeometry.boundingBox.max.y + 0.004;

    const bodyMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x0a1119,
        metalness: 0.62,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
        envMapIntensity: 0.5
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    tiltGroup.add(body);

    const topGeometry = new THREE.ShapeGeometry(pugliaShape, 1);
    const positions = topGeometry.attributes.position;
    const uvs = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        uvs[i * 2] = (x + W / 2) / W;
        uvs[i * 2 + 1] = (y + H / 2) / H;
    }
    topGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    topGeometry.rotateX(-Math.PI / 2);

    const topMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: true
    });

    if (textureImage) {
        const map = new THREE.Texture(textureImage);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        map.needsUpdate = true;
        topMaterial.map = map;
    } else {
        topMaterial.color = new THREE.Color(0x0c2a45);
    }

    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = topY;
    tiltGroup.add(top);

    // Thin gold rim around the map, like the edge of an old atlas plate.
    const rimPoints = points.map((point) => new THREE.Vector3(point.x, topY + 0.002, -point.y));
    const rim = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(rimPoints),
        new THREE.LineBasicMaterial({
            color: new THREE.Color(0xc7a76a).multiplyScalar(1.25),
            transparent: true,
            opacity: 0.58,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    tiltGroup.add(rim);

    // A soft pool of light under the atlas.
    const poolTexture = makeRadialTexture(THREE, [
        [0, 'rgba(125,211,252,0.4)'],
        [0.42, 'rgba(56,189,248,0.11)'],
        [1, 'rgba(56,189,248,0)']
    ]);
    const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(3.1, 3.1),
        new THREE.MeshBasicMaterial({
            map: poolTexture,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            opacity: 0.7
        })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = -0.012;
    pool.scale.set(1, 0.76, 1);
    tiltGroup.add(pool);

    /* ---------- hubs ----------------------------------------------------- */

    const glowTexture = makeGlowTexture(THREE);
    const hubObjects = [];
    const pickMeshes = [];
    const hubPositions = new Map();
    const pulseRings = [];

    hubs.forEach((hub, index) => {
        const x = (hub.x - 0.5) * W;
        const z = (hub.y - 0.5) * H;
        const color = new THREE.Color(hub.color);
        const bright = color.clone().multiplyScalar(2.2);

        const group = new THREE.Group();
        group.position.set(x, topY, z);
        tiltGroup.add(group);

        const baseRing = new THREE.Mesh(
            new THREE.RingGeometry(0.038, 0.05, 40),
            new THREE.MeshBasicMaterial({
                color: bright,
                transparent: true,
                opacity: 0.95,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        baseRing.rotation.x = -Math.PI / 2;
        baseRing.position.y = 0.004;
        group.add(baseRing);

        const beamHeight = 0.09 + (index % 3) * 0.022;
        const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0035, 0.0075, beamHeight, 8),
            new THREE.MeshBasicMaterial({
                color: bright,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        beam.position.y = beamHeight / 2;
        group.add(beam);

        const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.019, 18, 18),
            new THREE.MeshBasicMaterial({ color: bright })
        );
        orb.position.y = beamHeight;
        group.add(orb);

        const glow = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: glowTexture,
                color: bright,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        glow.scale.setScalar(0.24);
        glow.position.y = beamHeight;
        group.add(glow);

        const pulseMaterial = new THREE.MeshBasicMaterial({
            color: bright,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const pulse = new THREE.Mesh(new THREE.RingGeometry(0.052, 0.058, 44), pulseMaterial);
        pulse.rotation.x = -Math.PI / 2;
        pulse.position.y = 0.005;
        group.add(pulse);
        pulseRings.push({ mesh: pulse, phase: index * 0.63 });

        const pick = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 8, 8),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0,
                depthWrite: false
            })
        );
        pick.position.y = 0.055;
        pick.userData.hub = hub;
        group.add(pick);
        pickMeshes.push(pick);

        group.scale.setScalar(0.001);
        hubObjects.push(group);
        hubPositions.set(hub.id, new THREE.Vector3(x, topY + 0.02, z));
    });

    /* ---------- routes & travelling blocks ------------------------------- */

    const arcsGroup = new THREE.Group();
    tiltGroup.add(arcsGroup);

    const edges = [
        ['foggia', 'barletta'],
        ['barletta', 'molfetta'],
        ['molfetta', 'bari'],
        ['bari', 'ostuni'],
        ['ostuni', 'lecce'],
        ['bari', 'taranto'],
        ['taranto', 'lecce'],
        ['bari', 'foggia']
    ];

    const routeLines = [];
    const travellers = [];
    const travelGeometry = new THREE.BoxGeometry(0.016, 0.016, 0.016);

    edges.forEach(([from, to], index) => {
        const start = hubPositions.get(from);
        const end = hubPositions.get(to);
        if (!start || !end) return;

        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        midpoint.y += 0.12 + start.distanceTo(end) * 0.15;

        const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
        const routeGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(56));

        const routeMaterial = new THREE.LineBasicMaterial({
            color: new THREE.Color(0x7dd3fc).multiplyScalar(1.5),
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const line = new THREE.Line(routeGeometry, routeMaterial);
        arcsGroup.add(line);
        routeLines.push(routeMaterial);

        const travellersCount = index % 2 === 0 ? 2 : 1;
        for (let i = 0; i < travellersCount; i += 1) {
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(i === 0 ? 0xc7f0ff : 0xf4d59a).multiplyScalar(2.4)
            });
            const block = new THREE.Mesh(travelGeometry, material);
            arcsGroup.add(block);
            travellers.push({
                mesh: block,
                curve,
                offset: (index * 0.17 + i * 0.5) % 1,
                speed: 0.06 + (index % 3) * 0.015
            });
        }
    });

    /* ---------- compass / ledger ring ------------------------------------ */

    const ringGroup = new THREE.Group();
    ringGroup.position.y = 0.018;
    ringGroup.scale.set(1, 1, 0.7);
    tiltGroup.add(ringGroup);

    const gold = new THREE.Color(0xc7a76a).multiplyScalar(1.1);
    const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.44, 0.0035, 4, 220),
        new THREE.MeshBasicMaterial({
            color: gold,
            transparent: true,
            opacity: 0.52,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    outerRing.rotation.x = -Math.PI / 2;
    ringGroup.add(outerRing);

    const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.33, 0.0022, 3, 200),
        new THREE.MeshBasicMaterial({
            color: gold,
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    innerRing.rotation.x = -Math.PI / 2;
    ringGroup.add(innerRing);

    const tickPoints = [];
    for (let i = 0; i < 120; i += 1) {
        const angle = (i / 120) * Math.PI * 2;
        const long = i % 10 === 0;
        const inner = 1.44 - (long ? 0.06 : 0.025);
        tickPoints.push(
            new THREE.Vector3(Math.cos(angle) * inner, 0, Math.sin(angle) * inner),
            new THREE.Vector3(Math.cos(angle) * 1.44, 0, Math.sin(angle) * 1.44)
        );
    }
    const ticks = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(tickPoints),
        new THREE.LineBasicMaterial({
            color: gold,
            transparent: true,
            opacity: 0.34,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    ringGroup.add(ticks);

    const sweepMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x7dd3fc).multiplyScalar(1.7),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const sweep = new THREE.Mesh(
        new THREE.TorusGeometry(1.44, 0.0055, 4, 44, Math.PI * 0.22),
        sweepMaterial
    );
    sweep.rotation.x = -Math.PI / 2;
    ringGroup.add(sweep);

    const sweepGold = new THREE.Mesh(
        new THREE.TorusGeometry(1.44, 0.004, 4, 36, Math.PI * 0.12),
        new THREE.MeshBasicMaterial({
            color: gold,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    sweepGold.rotation.x = -Math.PI / 2;
    ringGroup.add(sweepGold);

    // Four small cardinal markers around the ring.
    const cardinals = ['N', 'E', 'S', 'O'];
    // Camera looks from +Z, so screen-top is -Z, screen-right is +X.
    const cardinalAngles = [(Math.PI * 3) / 2, 0, Math.PI / 2, Math.PI];
    cardinals.forEach((label, index) => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, 64, 64);
        context.beginPath();
        context.arc(32, 32, 24, 0, Math.PI * 2);
        context.fillStyle = 'rgba(7, 12, 18, 0.78)';
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = 'rgba(199, 167, 106, 0.42)';
        context.stroke();
        context.fillStyle = 'rgba(222, 193, 138, 0.95)';
        context.font = '600 24px "JetBrains Mono", monospace';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(label, 32, 34);
        const labelTexture = new THREE.CanvasTexture(canvas);
        labelTexture.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: labelTexture,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                depthTest: false
            })
        );
        const angle = cardinalAngles[index];
        sprite.position.set(Math.cos(angle) * 1.32, 0.035, Math.sin(angle) * 1.32);
        sprite.scale.setScalar(0.15);
        sprite.renderOrder = 10;
        sprite.frustumCulled = false;
        ringGroup.add(sprite);
    });

    /* ---------- constellation dust --------------------------------------- */

    const dustCount = 220;
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
        const radius = 1.7 + Math.random() * 2.1;
        const angle = Math.random() * Math.PI * 2;
        dustPositions[i * 3] = Math.cos(angle) * radius;
        dustPositions[i * 3 + 1] = 0.05 + Math.random() * 2.2;
        dustPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(
        dustGeometry,
        new THREE.PointsMaterial({
            color: 0x9bd7ff,
            size: 0.012,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        })
    );
    constellation.add(dust);

    /* ---------- post processing ------------------------------------------ */

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    composer.setSize(initial.width, initial.height);
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(new THREE.Vector2(initial.width, initial.height), 0.58, 0.72, 0.72);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    /* ---------- interaction state ---------------------------------------- */

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-2, -2);
    const tooltip = document.createElement('div');
    tooltip.className = 'ac-stage-tip';
    tooltip.innerHTML = '<strong></strong><span></span>';
    stage.appendChild(tooltip);
    const tooltipName = tooltip.querySelector('strong');
    const tooltipMeta = tooltip.querySelector('span');

    let paused = false;
    let visible = true;
    let dragging = false;
    let dragYaw = 0;
    let dragPitch = 0;
    let hoverYaw = 0;
    let hoverPitch = 0;
    let scrollYaw = 0;
    let scrollProgress = 0.35;
    let pointerDown = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let needsRender = true;
    let elapsed = 0;
    let hoveredHub = null;

    const clock = new THREE.Clock();

    const updateScroll = () => {
        const rect = stage.getBoundingClientRect();
        const viewport = window.innerHeight || 1;
        const progress = clamp((viewport - rect.top) / (viewport + rect.height), 0, 1);
        scrollProgress += (progress - scrollProgress) * 0.08;
        scrollYaw = (scrollProgress - 0.35) * 0.3;
        needsRender = true;
    };

    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();

    const setPointerFromEvent = (event) => {
        const rect = stage.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        if (!dragging) {
            hoverYaw = pointer.x * 0.12;
            hoverPitch = pointer.y * 0.045;
            needsRender = true;
        }
    };

    const showTooltip = (hub, event) => {
        const rect = stage.getBoundingClientRect();
        tooltipName.textContent = hub.name;
        tooltipMeta.textContent = `${hub.typeLabel} · ${hub.city}`;
        tooltip.style.left = `${clamp(event.clientX - rect.left, 60, rect.width - 60)}px`;
        tooltip.style.top = `${clamp(event.clientY - rect.top - 12, 40, rect.height - 30)}px`;
        tooltip.classList.add('is-visible');
    };

    const hideTooltip = () => {
        tooltip.classList.remove('is-visible');
    };

    const onPointerMove = (event) => {
        setPointerFromEvent(event);

        if (dragging) {
            const deltaX = event.clientX - lastPointerX;
            const deltaY = event.clientY - lastPointerY;
            lastPointerX = event.clientX;
            lastPointerY = event.clientY;
            dragYaw = clamp(dragYaw + deltaX * 0.005, -0.62, 0.62);
            dragPitch = clamp(dragPitch - deltaY * 0.0016, -0.1, 0.1);
            hideTooltip();
            needsRender = true;
            return;
        }

        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(pickMeshes, false)[0];
        if (hit) {
            if (hoveredHub !== hit.object) {
                hoveredHub = hit.object;
                renderer.domElement.style.cursor = 'pointer';
            }
            renderer.domElement.style.cursor = 'pointer';
            showTooltip(hit.object.userData.hub, event);
        } else {
            hoveredHub = null;
            renderer.domElement.style.cursor = 'grab';
            hideTooltip();
        }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });
    renderer.domElement.addEventListener('pointerleave', () => {
        hideTooltip();
        hoverYaw = 0;
        hoverPitch = 0;
        needsRender = true;
    });

    renderer.domElement.addEventListener('pointerdown', (event) => {
        dragging = true;
        pointerDown = true;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        stage.classList.add('is-dragging');
        hideTooltip();
        if (renderer.domElement.setPointerCapture) {
            try {
                renderer.domElement.setPointerCapture(event.pointerId);
            } catch (error) {
                /* ignore */
            }
        }
    });

    const endDrag = () => {
        dragging = false;
        pointerDown = false;
        stage.classList.remove('is-dragging');
        needsRender = true;
    };

    renderer.domElement.addEventListener('pointerup', endDrag);
    renderer.domElement.addEventListener('pointercancel', endDrag);

    const toggle = stage.querySelector('[data-stage-toggle]');
    if (toggle) {
        toggle.addEventListener('click', () => {
            paused = !paused;
            stage.classList.toggle('is-paused', paused);
            toggle.setAttribute('aria-pressed', String(paused));
            toggle.setAttribute(
                'aria-label',
                paused ? "Riprendi l'animazione dell'atlante" : "Metti in pausa l'animazione dell'atlante"
            );
            needsRender = true;
        });
    }

    /* ---------- resize ---------------------------------------------------- */

    const resize = () => {
        const next = size();
        renderer.setSize(next.width, next.height, false);
        composer.setSize(next.width, next.height);
        camera.aspect = next.width / next.height;
        camera.updateProjectionMatrix();
        needsRender = true;
    };

    if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(stage);
    } else {
        window.addEventListener('resize', resize, { passive: true });
    }

    /* ---------- visibility ------------------------------------------------ */

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            ([entry]) => {
                visible = entry.isIntersecting;
                if (visible) needsRender = true;
            },
            { threshold: 0.04 }
        );
        observer.observe(stage);
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) needsRender = true;
    });

    /* ---------- entrance -------------------------------------------------- */

    const gsap = window.gsap;
    const intro = () => {
        if (!gsap) {
            introGroup.scale.setScalar(1);
            introGroup.rotation.y = 0;
            hubObjects.forEach((group) => group.scale.setScalar(1));
            routeLines.forEach((material) => {
                material.opacity = 0.3;
            });
            needsRender = true;
            return;
        }

        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
        timeline
            .fromTo(
                introGroup.scale,
                { x: 0.86, y: 0.86, z: 0.86 },
                { x: 1, y: 1, z: 1, duration: 2.3 },
                0
            )
            .fromTo(introGroup.rotation, { y: -0.62 }, { y: 0, duration: 2.5 }, 0)
            .fromTo(camera.position, { z: 5.05, y: 3.75 }, { z: 3.6, y: 3.05, duration: 2.45 }, 0)
            .fromTo(
                hubObjects.map((group) => group.scale),
                { x: 0.001, y: 0.001, z: 0.001 },
                {
                    x: 1,
                    y: 1,
                    z: 1,
                    duration: 0.9,
                    stagger: 0.075,
                    ease: 'back.out(2.2)'
                },
                0.55
            )
            .fromTo(
                routeLines,
                { opacity: 0 },
                { opacity: 0.3, duration: 1.4, stagger: 0.045 },
                0.8
            );
    };

    // First frame, then reveal and animate.
    composer.render();
    requestAnimationFrame(() => {
        stage.classList.remove('is-loading');
        stage.classList.add('is-live');
        intro();
        needsRender = true;
    });

    /* ---------- loop ------------------------------------------------------ */

    const frame = () => {
        requestAnimationFrame(frame);
        if (!visible || document.hidden) return;

        const delta = Math.min(clock.getDelta(), 0.05);
        if (!paused) {
            elapsed += delta;
        }

        const autoYaw = Math.sin(elapsed * 0.19) * 0.035;
        const targetYaw = dragYaw + hoverYaw + scrollYaw + autoYaw;
        const targetPitch = dragPitch + hoverPitch;

        const yawEase = paused ? 1 : 0.075;
        const pitchEase = paused ? 1 : 0.075;
        const currentYaw = tiltGroup.rotation.y;
        const currentPitch = tiltGroup.rotation.x;

        if (Math.abs(targetYaw - currentYaw) > 0.0001 || Math.abs(targetPitch - currentPitch) > 0.0001) {
            tiltGroup.rotation.y = currentYaw + (targetYaw - currentYaw) * yawEase;
            tiltGroup.rotation.x = currentPitch + (targetPitch - currentPitch) * pitchEase;
            needsRender = true;
        }

        if (!paused) {
            tiltGroup.position.y = Math.sin(elapsed * 0.72) * 0.012;

            pulseRings.forEach((entry) => {
                const phase = (elapsed * 0.38 + entry.phase) % 1;
                const scale = 0.75 + phase * 1.75;
                entry.mesh.scale.setScalar(scale);
                entry.mesh.material.opacity = (1 - phase) * 0.52;
            });

            travellers.forEach((traveller) => {
                const t = (elapsed * traveller.speed + traveller.offset) % 1;
                traveller.curve.getPoint(t, traveller.mesh.position);
                traveller.mesh.rotation.y = elapsed * 2.1;
            });

            sweep.rotation.z = -elapsed * 0.22;
            sweepGold.rotation.z = elapsed * 0.13;
            dust.rotation.y = elapsed * 0.018;
            constellation.rotation.y = elapsed * 0.006;
            needsRender = true;
        }

        if (!paused || needsRender) {
            composer.render();
            needsRender = false;
        }
    };

    frame();
}
