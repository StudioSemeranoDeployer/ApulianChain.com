/* ==========================================================================
   ApulianChain — Network cartography
   Renders the seven hubs, the dashed routes and the hub detail card from
   assets/data/network.json. The map itself is the hand-drawn Puglia artwork,
   so there are no tiles, API keys or third-party requests.
   ========================================================================== */

const mapRoot = document.querySelector('[data-network-map]');

if (mapRoot) {
    initNetworkMap(mapRoot);
}

function initNetworkMap(root) {
    const frame = root.querySelector('[data-network-frame]');
    const pinLayer = root.querySelector('[data-network-pins]');
    const routesLayer = root.querySelector('[data-network-routes]');
    const legend = root.querySelector('[data-network-legend]');
    const detail = root.querySelector('[data-network-detail]');
    if (!frame || !pinLayer || !routesLayer || !legend || !detail) return;

    let hubs = [];
    let activeId = null;
    let filterType = null;

    const detailFields = {
        type: detail.querySelector('[data-detail-type]'),
        city: detail.querySelector('[data-detail-city]'),
        partner: detail.querySelector('[data-detail-partner]'),
        name: detail.querySelector('[data-detail-name]'),
        description: detail.querySelector('[data-detail-description]'),
        index: detail.querySelector('[data-detail-index]')
    };

    const byId = (id) => hubs.find((hub) => hub.id === id);

    const selectHub = (id, options = {}) => {
        const hub = byId(id);
        if (!hub) return;
        if (filterType && hub.type !== filterType) return;

        activeId = id;
        pinLayer.querySelectorAll('.ac-pin').forEach((pin) => {
            const active = pin.dataset.hub === id;
            pin.classList.toggle('is-active', active);
            pin.setAttribute('aria-pressed', String(active));
            if (active) pin.setAttribute('aria-current', 'true');
            else pin.removeAttribute('aria-current');
        });

        detail.style.setProperty('--detail-color', hub.color);
        detailsPaint(hub);

        if (options.focus) {
            const pin = pinLayer.querySelector(`[data-hub="${id}"]`);
            if (pin) pin.focus({ preventScroll: true });
        }
    };

    const detailsPaint = (hub) => {
        const index = hubs.findIndex((item) => item.id === hub.id) + 1;
        const padded = String(index).padStart(2, '0');
        if (detailFields.type) detailFields.type.textContent = hub.typeLabel;
        if (detailFields.city) detailFields.city.textContent = hub.city;
        if (detailFields.partner) detailFields.partner.textContent = hub.partner;
        if (detailFields.name) detailFields.name.textContent = hub.name;
        if (detailFields.description) detailFields.description.textContent = hub.description;
        if (detailFields.index) detailFields.index.textContent = `HUB ${padded} / ${String(hubs.length).padStart(2, '0')}`;
    };

    const createPin = (hub) => {
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'ac-pin';
        pin.dataset.hub = hub.id;
        pin.dataset.type = hub.type;
        pin.dataset.side = hub.labelSide || 'right';
        pin.style.setProperty('--x', `${hub.x * 100}%`);
        pin.style.setProperty('--y', `${hub.y * 100}%`);
        pin.style.setProperty('--pin', hub.color);
        pin.setAttribute('aria-label', `${hub.name}, ${hub.typeLabel} a ${hub.city}`);
        pin.setAttribute('aria-pressed', 'false');

        const ring = document.createElement('span');
        ring.className = 'ac-pin-ring';
        ring.setAttribute('aria-hidden', 'true');

        const core = document.createElement('span');
        core.className = 'ac-pin-core';
        core.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.className = 'ac-pin-label';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = hub.shortName || hub.city;

        pin.append(ring, core, label);
        pin.addEventListener('click', () => selectHub(hub.id));
        pin.addEventListener('focus', () => selectHub(hub.id));
        pin.addEventListener('keydown', (event) => {
            const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
            if (!keys.includes(event.key)) return;
            event.preventDefault();

            const pins = [...pinLayer.querySelectorAll('.ac-pin:not([tabindex="-1"])')];
            const current = pins.indexOf(pin);
            if (current === -1) return;

            let nextIndex = current;
            if (event.key === 'Home') nextIndex = 0;
            else if (event.key === 'End') nextIndex = pins.length - 1;
            else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (current + 1) % pins.length;
            else nextIndex = (current - 1 + pins.length) % pins.length;

            const target = pins[nextIndex];
            selectHub(target.dataset.hub, { focus: true });
        });

        return pin;
    };

    const createRoutes = () => {
        const width = 1000;
        const height = 748;
        const svgNS = 'http://www.w3.org/2000/svg';
        routesLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
        routesLayer.setAttribute('preserveAspectRatio', 'none');

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

        const endpoints = new Set();

        edges.forEach(([from, to], index) => {
            const first = byId(from);
            const second = byId(to);
            if (!first || !second) return;

            const x1 = first.x * width;
            const y1 = first.y * height;
            const x2 = second.x * width;
            const y2 = second.y * height;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.max(1, Math.hypot(dx, dy));
            const bend = length * (index % 2 === 0 ? 0.12 : -0.12);
            const cx = (x1 + x2) / 2 + (-dy / length) * bend;
            const cy = (y1 + y2) / 2 + (dx / length) * bend;

            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`);
            path.style.animationDelay = `${index * -2.4}s`;
            routesLayer.appendChild(path);

            endpoints.add(`${first.id}:${x1.toFixed(2)}:${y1.toFixed(2)}`);
            endpoints.add(`${second.id}:${x2.toFixed(2)}:${y2.toFixed(2)}`);
        });

        endpoints.forEach((entry) => {
            const [id, x, y] = entry.split(':');
            const hub = byId(id);
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '2.6');
            if (hub) circle.setAttribute('stroke', hub.color);
            routesLayer.appendChild(circle);
        });
    };

    const buildLegend = () => {
        const groups = new Map();
        hubs.forEach((hub) => {
            if (!groups.has(hub.type)) {
                groups.set(hub.type, {
                    type: hub.type,
                    label: hub.typeLabel,
                    color: hub.color,
                    partner: hub.partner,
                    cities: []
                });
            }
            const group = groups.get(hub.type);
            group.cities.push(hub.city);
            group.color = hub.color;
        });

        legend.innerHTML = '';

        const all = document.createElement('button');
        all.type = 'button';
        all.className = 'ac-legend-item is-active';
        all.dataset.type = '';
        all.style.setProperty('--legend-color', '#B08D4F');
        all.innerHTML = `
            <span class="ac-legend-dot" aria-hidden="true"></span>
            <span>
                <span class="ac-legend-title">Tutti i nodi</span>
                <span class="ac-legend-meta">${hubs.length} hub · Puglia</span>
            </span>
        `;
        legend.appendChild(all);

        groups.forEach((group) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ac-legend-item';
            button.dataset.type = group.type;
            button.style.setProperty('--legend-color', group.color);
            button.innerHTML = `
                <span class="ac-legend-dot" aria-hidden="true"></span>
                <span>
                    <span class="ac-legend-title">${group.label}</span>
                    <span class="ac-legend-meta">${group.cities.join(' · ')} — ${group.partner}</span>
                </span>
            `;
            legend.appendChild(button);
        });

        legend.querySelectorAll('.ac-legend-item').forEach((button) => {
            button.addEventListener('click', () => {
                const nextType = button.dataset.type || null;
                filterType = filterType === nextType ? null : nextType;

                legend.querySelectorAll('.ac-legend-item').forEach((item) => {
                    const itemType = item.dataset.type || null;
                    item.classList.toggle('is-active', itemType === filterType || (!filterType && itemType === null));
                });

                applyFilter();
            });
        });
    };

    const applyFilter = () => {
        let firstVisible = null;
        pinLayer.querySelectorAll('.ac-pin').forEach((pin) => {
            const visible = !filterType || pin.dataset.type === filterType;
            pin.classList.toggle('is-dim', !visible);
            pin.tabIndex = visible ? 0 : -1;
            if (visible && !firstVisible) firstVisible = pin;
        });

        if (filterType) {
            const active = byId(activeId);
            if (!active || active.type !== filterType) {
                const target = hubs.find((hub) => hub.type === filterType);
                if (target) selectHub(target.id);
            }
        }
    };

    fetch(new URL('../data/network.json', import.meta.url), { credentials: 'same-origin' })
        .then((response) => {
            if (!response.ok) throw new Error(`Network data ${response.status}`);
            return response.json();
        })
        .then((data) => {
            hubs = data;
            if (!Array.isArray(hubs) || hubs.length === 0) throw new Error('Network data empty');

            const fragment = document.createDocumentFragment();
            hubs.forEach((hub) => fragment.appendChild(createPin(hub)));
            pinLayer.appendChild(fragment);

            createRoutes();
            buildLegend();
            selectHub((byId('bari') || hubs[0]).id);
        })
        .catch((error) => {
            console.warn('[Network] Hub data unavailable.', error);
            root.classList.add('is-unavailable');
            const note = root.querySelector('[data-network-note]');
            if (note) note.textContent = 'Dati rete non disponibili · riprova più tardi';
        });
}
