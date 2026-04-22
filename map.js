(function () {
    const DEFAULT_CITY = {
        name: 'Hyderabad, India',
        center: [78.4867, 17.3850],
        zoom: 11
    };

    const GEO_CACHE_KEY = 'onlifit_map_geo_cache_v1';
    const GEO_CACHE_LIMIT = 200;

    const state = {
        map: null,
        userLocation: null,
        userMarker: null,
        userRing: null,
        trainers: [],
        visibleTrainers: [],
        nearestTrainerId: null,
        activePopup: null,
        mapReady: false,
        loadingTrainers: true,
        mobileSheetOpen: false,
        geocodeCache: loadGeoCache(),
        geoRequests: new Map(),
        filters: {
            mode: 'offline',
            price: 'all',
            rating: 'all',
            blackOnly: false,
            radius: 'all'
        },
        centerLabel: DEFAULT_CITY.name,
        renderQueued: false
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        bindUi();
        requestAnimationFrame(() => {
            void renderAuthNav();
        });

        setStatus('Loading map and trainers...');

        initMap(DEFAULT_CITY.center);

        const centerPromise = getInitialCenter();
        const trainersPromise = loadTrainers();

        centerPromise.then((center) => {
            state.centerLabel = center.label;
            state.userLocation = center.userLocation;
            if (state.map) {
                state.map.easeTo({
                    center: center.coords,
                    zoom: center.userLocation ? 12 : DEFAULT_CITY.zoom
                });
            }
            if (state.userLocation) {
                updateUserMarker(center.coords);
                setStatus('Finding trainers near you...');
            } else {
                setStatus(`Showing ${center.label}`);
            }
            queueRefresh(true);
        }).catch(() => {
            state.centerLabel = DEFAULT_CITY.name;
            setStatus(`Showing ${DEFAULT_CITY.name}`);
        });

        const trainers = await trainersPromise;
        state.trainers = await enrichTrainers(trainers);
        state.loadingTrainers = false;
        queueRefresh(true);
    }

    function bindUi() {
        const controls = [
            'mode-filter',
            'price-filter',
            'rating-filter',
            'radius-filter',
            'black-only'
        ];

        controls.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                syncFiltersFromUi();
                queueRefresh();
            });
        });

        const citySearch = document.getElementById('city-search');
        const cityBtn = document.getElementById('city-search-btn');
        if (citySearch) {
            citySearch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    void searchCity();
                }
            });
        }
        if (cityBtn) cityBtn.addEventListener('click', () => void searchCity());

        const nearMeBtn = document.getElementById('near-me-btn');
        if (nearMeBtn) nearMeBtn.addEventListener('click', () => void focusNearMe());

        const fitBtn = document.getElementById('fit-btn');
        if (fitBtn) fitBtn.addEventListener('click', fitVisibleTrainers);

        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => queueRefresh(true));

        const mobileBtn = document.getElementById('mobile-sheet-btn');
        const mobileSheet = document.getElementById('mobile-sheet');
        const mobileClose = document.getElementById('mobile-sheet-close');
        if (mobileBtn && mobileSheet) {
            mobileBtn.addEventListener('click', () => {
                state.mobileSheetOpen = !state.mobileSheetOpen;
                mobileSheet.classList.toggle('open', state.mobileSheetOpen);
            });
        }
        if (mobileClose && mobileSheet) {
            mobileClose.addEventListener('click', () => {
                state.mobileSheetOpen = false;
                mobileSheet.classList.remove('open');
            });
        }
    }

    function syncFiltersFromUi() {
        state.filters.mode = document.getElementById('mode-filter')?.value || 'offline';
        state.filters.price = document.getElementById('price-filter')?.value || 'all';
        state.filters.rating = document.getElementById('rating-filter')?.value || 'all';
        state.filters.radius = document.getElementById('radius-filter')?.value || 'all';
        state.filters.blackOnly = !!document.getElementById('black-only')?.checked;
    }

    async function loadTrainers() {
        if (typeof getTrainers !== 'function') return [];
        const trainers = await getTrainers();
        return Array.isArray(trainers) ? trainers : [];
    }

    async function getInitialCenter() {
        const fallback = {
            coords: DEFAULT_CITY.center,
            label: DEFAULT_CITY.name,
            userLocation: null
        };

        if (!navigator.geolocation) return fallback;

        try {
            const position = await Promise.race([
                new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 6000,
                        maximumAge: 300000
                    });
                }),
                new Promise((resolve) => setTimeout(() => resolve(null), 6500))
            ]);

            if (!position || !position.coords) return fallback;

            return {
                coords: [position.coords.longitude, position.coords.latitude],
                label: 'Your location',
                userLocation: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                }
            };
        } catch {
            return fallback;
        }
    }

    function initMap(center) {
        if (state.map) return;

        state.map = new maplibregl.Map({
            container: 'map',
            style: 'https://demotiles.maplibre.org/style.json',
            center,
            zoom: state.userLocation ? 12 : DEFAULT_CITY.zoom
        });

        state.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

        state.map.on('load', () => {
            state.mapReady = true;
            state.map.addSource('trainers', {
                type: 'geojson',
                data: emptyCollection(),
                cluster: true,
                clusterMaxZoom: 13,
                clusterRadius: 55
            });

            state.map.addLayer({
                id: 'clusters',
                type: 'circle',
                source: 'trainers',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': '#000000',
                    'circle-opacity': 0.78,
                    'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        20,
                        10,
                        28,
                        30,
                        36
                    ]
                }
            });

            state.map.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: 'trainers',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['Arial Unicode MS Bold'],
                    'text-size': 12
                },
                paint: {
                    'text-color': '#ffffff'
                }
            });

            state.map.addLayer({
                id: 'unclustered-point',
                type: 'circle',
                source: 'trainers',
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': [
                        'case',
                        ['boolean', ['get', 'nearest'], false], '#000000',
                        ['boolean', ['get', 'black'], false], '#f59e0b',
                        '#ff5a5f'
                    ],
                    'circle-radius': 10,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });

            state.map.on('click', 'clusters', async (e) => {
                const feature = state.map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
                const clusterId = feature.properties.cluster_id;
                const source = state.map.getSource('trainers');
                source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) return;
                    state.map.easeTo({
                        center: feature.geometry.coordinates,
                        zoom
                    });
                });
            });

            state.map.on('click', 'unclustered-point', (e) => {
                const feature = e.features && e.features[0];
                if (!feature) return;
                openTrainerPopup(feature.properties.id);
            });

            state.map.on('mouseenter', 'clusters', () => {
                state.map.getCanvas().style.cursor = 'pointer';
            });
            state.map.on('mouseleave', 'clusters', () => {
                state.map.getCanvas().style.cursor = '';
            });
            state.map.on('mouseenter', 'unclustered-point', () => {
                state.map.getCanvas().style.cursor = 'pointer';
            });
            state.map.on('mouseleave', 'unclustered-point', () => {
                state.map.getCanvas().style.cursor = '';
            });

            state.map.on('moveend', () => {
                queueRefresh();
            });

            queueRefresh(true);
        });
    }

    async function searchCity() {
        const input = document.getElementById('city-search');
        const query = input?.value.trim();
        if (!query) return;

        const coords = await geocodeQuery(query);
        if (!coords) {
            setStatus('Could not find that city.');
            return;
        }

        state.userLocation = { lat: coords.lat, lng: coords.lng };
        state.centerLabel = query;
        updateUserMarker([coords.lng, coords.lat]);
        state.map.easeTo({ center: [coords.lng, coords.lat], zoom: 12 });
        setStatus(`Showing trainers around ${query}`);
        queueRefresh(true);
    }

    async function focusNearMe() {
        if (!navigator.geolocation) {
            setStatus('Geolocation is not available in this browser.');
            return;
        }

        setStatus('Finding your location...');
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 6000,
                    maximumAge: 300000
                });
            });

            state.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            state.centerLabel = 'Your location';
            updateUserMarker([state.userLocation.lng, state.userLocation.lat]);
            state.map.easeTo({ center: [state.userLocation.lng, state.userLocation.lat], zoom: 12 });

            const radius = document.getElementById('radius-filter')?.value || '10';
            if (radius === 'all') {
                document.getElementById('radius-filter').value = '10';
            }
            syncFiltersFromUi();
            queueRefresh(true);
        } catch {
            setStatus('Location permission denied. Showing the default city instead.');
            state.userLocation = null;
            state.map.easeTo({ center: DEFAULT_CITY.center, zoom: DEFAULT_CITY.zoom });
            queueRefresh(true);
        }
    }

    function updateUserMarker(center) {
        if (!state.map) return;

        if (state.userMarker) state.userMarker.remove();
        if (state.userRing) state.userRing.remove();

        const ring = document.createElement('div');
        ring.style.width = '24px';
        ring.style.height = '24px';
        ring.style.borderRadius = '9999px';
        ring.style.background = 'rgba(59, 130, 246, 0.18)';
        ring.style.border = '2px solid rgba(59, 130, 246, 0.4)';
        ring.style.boxShadow = '0 0 0 8px rgba(59, 130, 246, 0.08)';

        const dot = document.createElement('div');
        dot.style.width = '14px';
        dot.style.height = '14px';
        dot.style.borderRadius = '9999px';
        dot.style.background = '#3b82f6';
        dot.style.border = '2px solid #fff';
        dot.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.22)';

        state.userRing = new maplibregl.Marker({ element: ring })
            .setLngLat(center)
            .addTo(state.map);

        state.userMarker = new maplibregl.Marker({ element: dot })
            .setLngLat(center)
            .addTo(state.map);
    }

    async function enrichTrainers(trainers) {
        const list = Array.isArray(trainers) ? trainers : [];
        const enriched = [];

        for (const raw of list) {
            const trainer = normalizeTrainer(raw);
            const coords = await resolveTrainerCoordinates(trainer);
            if (!coords) continue;

            enriched.push({
                ...trainer,
                latitude: coords.lat,
                longitude: coords.lng,
                geocodeLabel: coords.label || trainer.geocodeLabel || ''
            });
        }

        return enriched;
    }

    function normalizeTrainer(raw) {
        const price = getTrainerPrice(raw);
        const mode = normalizeMode(raw.training_mode || raw.session_mode);
        return {
            ...raw,
            price,
            mode,
            black: Boolean(raw.hasBlackStatus ?? raw.has_black_status),
            rating: Number(raw.rating) || 0,
            review_count: Number(raw.review_count) || 0
        };
    }

    function normalizeMode(mode) {
        const value = String(mode || '').toLowerCase();
        if (value === 'offline') return 'offline';
        if (value === 'online') return 'online';
        if (value === 'both') return 'both';
        return '';
    }

    function getTrainerPrice(trainer) {
        const raw = trainer?.plans?.hourly?.price;
        const price = typeof raw === 'string' ? Number(raw) : raw;
        return Number.isFinite(price) ? price : null;
    }

    function buildGeocodeQuery(trainer) {
        const parts = [];
        if (trainer?.location) parts.push(trainer.location);
        const cityState = [trainer?.city, trainer?.state].filter(Boolean).join(', ');
        if (cityState && cityState !== trainer?.location) parts.push(cityState);
        const query = parts.filter(Boolean).join(', ').trim();
        return query || null;
    }

    async function resolveTrainerCoordinates(trainer) {
        const directLat = Number(trainer.latitude ?? trainer.lat);
        const directLng = Number(trainer.longitude ?? trainer.lng);

        if (Number.isFinite(directLat) && Number.isFinite(directLng)) {
            return { lat: directLat, lng: directLng, label: trainer.location || trainer.city || '' };
        }

        const query = buildGeocodeQuery(trainer);
        if (!query) return null;

        const key = query.toLowerCase();
        if (state.geocodeCache[key]) return state.geocodeCache[key];
        if (state.geoRequests.has(key)) return state.geoRequests.get(key);

        const promise = geocodeQuery(query).then((coords) => {
            if (coords) {
                state.geocodeCache[key] = coords;
                trimGeoCache();
                persistGeoCache();
            }
            return coords;
        });

        state.geoRequests.set(key, promise);
        const result = await promise;
        state.geoRequests.delete(key);
        return result;
    }

    function trimGeoCache() {
        const keys = Object.keys(state.geocodeCache);
        if (keys.length <= GEO_CACHE_LIMIT) return;
        keys.slice(0, keys.length - GEO_CACHE_LIMIT).forEach(key => {
            delete state.geocodeCache[key];
        });
    }

    async function geocodeQuery(query) {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        const feature = data?.features?.[0];
        const coords = feature?.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;

        return {
            lng: Number(coords[0]),
            lat: Number(coords[1]),
            label: feature?.properties?.name || query
        };
    }

    function loadGeoCache() {
        try {
            return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}') || {};
        } catch {
            return {};
        }
    }

    function persistGeoCache() {
        try {
            localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(state.geocodeCache));
        } catch {
            // Non-fatal
        }
    }

    function queueRefresh(force = false) {
        if (force) {
            state.renderQueued = false;
        }
        if (state.renderQueued) return;
        state.renderQueued = true;
        requestAnimationFrame(() => {
            state.renderQueued = false;
            refreshView();
        });
    }

    function refreshView() {
        if (!state.mapReady || !state.map) return;

        const allFiltered = filterTrainers(state.trainers);
        const boundsFiltered = filterByBounds(allFiltered);

        state.visibleTrainers = boundsFiltered;
        state.nearestTrainerId = getNearestTrainerId(boundsFiltered);

        updateSource(boundsFiltered);
        renderTrainerLists(boundsFiltered);
        updateSummary(boundsFiltered, allFiltered);
        updateStatus(boundsFiltered, allFiltered);
    }

    function filterTrainers(trainers) {
        let filtered = Array.isArray(trainers) ? [...trainers] : [];

        filtered = filtered.filter(trainer => {
            if (!matchesMode(trainer.mode, state.filters.mode)) return false;
            if (!matchesPrice(trainer.price, state.filters.price)) return false;
            if (!matchesRating(trainer.rating, state.filters.rating)) return false;
            if (state.filters.blackOnly && !trainer.black) return false;
            if (!matchesRadius(trainer)) return false;
            return true;
        });

        if (state.userLocation) {
            filtered.forEach(trainer => {
                trainer.distanceKm = haversineKm(
                    state.userLocation.lat,
                    state.userLocation.lng,
                    trainer.latitude,
                    trainer.longitude
                );
            });
            filtered.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
        } else {
            filtered.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
        }

        return filtered;
    }

    function matchesMode(trainerMode, filterMode) {
        if (filterMode === 'all') return true;
        if (filterMode === 'both') return trainerMode === 'both';
        if (filterMode === 'online') return trainerMode === 'online' || trainerMode === 'both';
        if (filterMode === 'offline') return trainerMode === 'offline' || trainerMode === 'both';
        return true;
    }

    function matchesPrice(price, filterValue) {
        if (filterValue === 'all' || price === null || price === undefined) return true;
        if (filterValue === '0-500') return price < 500;
        if (filterValue === '500-1000') return price >= 500 && price <= 1000;
        if (filterValue === '1000+') return price > 1000;
        return true;
    }

    function matchesRating(rating, filterValue) {
        if (filterValue === 'all') return true;
        const min = Number(filterValue);
        return Number(rating) >= min;
    }

    function matchesRadius(trainer) {
        const radius = state.filters.radius;
        if (radius === 'all' || !state.userLocation) return true;
        const limit = Number(radius);
        if (!Number.isFinite(limit)) return true;
        const distance = haversineKm(
            state.userLocation.lat,
            state.userLocation.lng,
            trainer.latitude,
            trainer.longitude
        );
        trainer.distanceKm = distance;
        return distance <= limit;
    }

    function filterByBounds(trainers) {
        if (!state.map) return trainers;
        const bounds = state.map.getBounds();
        return trainers.filter(trainer => bounds.contains([trainer.longitude, trainer.latitude]));
    }

    function getNearestTrainerId(trainers) {
        if (!state.userLocation || !trainers.length) return null;
        let nearest = null;
        let nearestDistance = Infinity;

        trainers.forEach(trainer => {
            const distance = Number.isFinite(trainer.distanceKm)
                ? trainer.distanceKm
                : haversineKm(
                    state.userLocation.lat,
                    state.userLocation.lng,
                    trainer.latitude,
                    trainer.longitude
                );
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = trainer.id;
            }
        });

        return nearest;
    }

    function updateSource(trainers) {
        const source = state.map.getSource('trainers');
        if (!source) return;

        const features = trainers.map(trainer => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [trainer.longitude, trainer.latitude]
            },
            properties: {
                id: trainer.id,
                name: trainer.name || 'Trainer',
                avatar_url: trainer.avatar_url || '',
                rating: Number(trainer.rating) || 0,
                review_count: Number(trainer.review_count) || 0,
                price: trainer.price ?? '',
                mode: trainer.mode || '',
                black: trainer.black ? '1' : '',
                nearest: state.nearestTrainerId === trainer.id ? '1' : '',
                distance: Number.isFinite(trainer.distanceKm) ? trainer.distanceKm.toFixed(1) : '',
                location: buildTrainerLocationLabel(trainer)
            }
        }));

        source.setData({
            type: 'FeatureCollection',
            features
        });
    }

    function buildTrainerLocationLabel(trainer) {
        const cityState = [trainer?.city, trainer?.state].filter(Boolean).join(', ');
        return (cityState || trainer?.location || '').trim();
    }

    function renderTrainerLists(trainers) {
        const list = document.getElementById('trainer-list');
        const mobileList = document.getElementById('mobile-trainer-list');
        const panelCount = document.getElementById('panel-count');
        const visibleCount = document.getElementById('visible-count');

        const html = trainers.length
            ? trainers.map((trainer, index) => renderTrainerCard(trainer, index)).join('')
            : `<div class="text-center py-16 text-on-surface-variant">
                    <span class="material-symbols-outlined text-5xl mb-3">search_off</span>
                    <p class="font-bold">No trainers found</p>
                    <p class="text-sm mt-1">Try a different city, price, or rating filter.</p>
               </div>`;

        if (list) list.innerHTML = html;
        if (mobileList) mobileList.innerHTML = html;
        if (panelCount) panelCount.textContent = String(trainers.length);
        if (visibleCount) visibleCount.textContent = `${trainers.length} trainers`;

        attachTrainerCardHandlers();
    }

    function renderTrainerCard(trainer, index) {
        const distance = Number.isFinite(trainer.distanceKm) ? `${trainer.distanceKm.toFixed(1)} km` : '';
        const nearestBadge = state.nearestTrainerId === trainer.id
            ? `<span class="px-2 py-1 rounded-full bg-primary text-on-primary text-[10px] font-black uppercase tracking-widest">Nearest</span>`
            : '';
        const blackBadge = trainer.black
            ? `<span class="px-2 py-1 rounded-full bg-black text-yellow-300 text-[10px] font-black uppercase tracking-widest">OnliFit Black</span>`
            : '';

        return `
            <article class="trainer-card" data-trainer-id="${escapeHtml(trainer.id)}" data-index="${index}">
                <div class="trainer-avatar">
                    ${renderAvatar(trainer)}
                </div>
                <div>
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <h3 class="font-headline font-bold text-sm leading-tight">${escapeHtml(trainer.name || 'Trainer')}</h3>
                            <p class="text-[11px] text-on-surface-variant mt-1">${escapeHtml(trainer.mode || 'offline')}</p>
                        </div>
                        ${nearestBadge}
                    </div>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${blackBadge}
                        ${distance ? `<span class="px-2 py-1 rounded-full bg-surface-container text-[10px] font-bold uppercase tracking-widest">${escapeHtml(distance)}</span>` : ''}
                    </div>
                    <div class="mt-2 text-sm font-bold text-on-surface">${renderPriceLabel(trainer.price)}</div>
                    <div class="mt-1 text-xs text-on-surface-variant">Rating: ${Number(trainer.rating || 0).toFixed(1)} (${trainer.review_count || 0})</div>
                    <div class="mt-3 flex gap-2">
                        <button class="view-profile-btn px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold" data-trainer-id="${escapeHtml(trainer.id)}">View Profile</button>
                        <button class="book-now-btn px-3 py-2 rounded-xl bg-surface-container-low text-on-surface-variant text-xs font-bold" data-trainer-id="${escapeHtml(trainer.id)}">Book Now</button>
                    </div>
                </div>
            </article>
        `;
    }

    function attachTrainerCardHandlers() {
        document.querySelectorAll('.view-profile-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trainerId = btn.getAttribute('data-trainer-id');
                window.location.href = `trainer-profile.html?id=${encodeURIComponent(trainerId)}`;
            };
        });

        document.querySelectorAll('.book-now-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trainerId = btn.getAttribute('data-trainer-id');
                window.location.href = `trainer-profile.html?id=${encodeURIComponent(trainerId)}`;
            };
        });

        document.querySelectorAll('.trainer-card').forEach(card => {
            card.onclick = () => {
                const trainerId = card.getAttribute('data-trainer-id');
                focusTrainer(trainerId);
            };
        });
    }

    function focusTrainer(trainerId) {
        const trainer = state.trainers.find(item => item.id === trainerId);
        if (!trainer || !state.map) return;

        state.map.easeTo({
            center: [trainer.longitude, trainer.latitude],
            zoom: Math.max(state.map.getZoom(), 13)
        });
        openTrainerPopup(trainerId);
    }

    function openTrainerPopup(trainerId) {
        const trainer = state.trainers.find(item => item.id === trainerId);
        if (!trainer || !state.map) return;

        const html = buildPopupHtml(trainer);
        if (state.activePopup) state.activePopup.remove();

        state.activePopup = new maplibregl.Popup({ offset: 16, closeButton: true })
            .setLngLat([trainer.longitude, trainer.latitude])
            .setHTML(html)
            .addTo(state.map);
    }

    function buildPopupHtml(trainer) {
        const distance = Number.isFinite(trainer.distanceKm) ? `${trainer.distanceKm.toFixed(1)} km away` : '';
        return `
            <div class="popup-card">
                <img class="popup-card__image" src="${escapeAttr(getTrainerImage(trainer))}" alt="${escapeAttr(trainer.name || 'Trainer')}">
                <div class="popup-card__body">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <h3 class="font-headline font-bold text-base leading-tight">${escapeHtml(trainer.name || 'Trainer')}</h3>
                            <p class="text-xs text-on-surface-variant mt-1">${escapeHtml(buildTrainerLocationLabel(trainer) || 'Offline trainer')}</p>
                        </div>
                        ${trainer.black ? '<span class="px-2 py-1 rounded-full bg-black text-yellow-300 text-[10px] font-black uppercase tracking-widest">Black</span>' : ''}
                    </div>
                    <div class="mt-2 text-sm font-bold text-on-surface">Rating ${Number(trainer.rating || 0).toFixed(1)} (${trainer.review_count || 0})</div>
                    <div class="mt-1 text-sm font-bold text-primary">${renderPriceLabel(trainer.price)}</div>
                    ${distance ? `<div class="mt-1 text-xs text-on-surface-variant">${escapeHtml(distance)}</div>` : ''}
                    <div class="popup-actions">
                        <a href="trainer-profile.html?id=${encodeURIComponent(trainer.id)}" class="flex-1 text-center px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">View Profile</a>
                        <a href="trainer-profile.html?id=${encodeURIComponent(trainer.id)}" class="flex-1 text-center px-3 py-2 rounded-xl bg-surface-container-low text-on-surface-variant text-xs font-bold">Book Now</a>
                    </div>
                </div>
            </div>
        `;
    }

    function renderAvatar(trainer) {
        const url = (trainer.avatar_url || '').trim();
        if (url && /^https?:\/\//i.test(url)) {
            return `<img src="${escapeAttr(url)}" alt="${escapeAttr(trainer.name || 'Trainer')}" style="width:100%;height:100%;object-fit:cover;">`;
        }

        return `<span>${escapeHtml((trainer.name || 'T').charAt(0).toUpperCase())}</span>`;
    }

    function getTrainerImage(trainer) {
        const url = (trainer.avatar_url || '').trim();
        if (url && /^https?:\/\//i.test(url)) return url;
        return 'https://placehold.co/600x400/f5f5f5/111111?text=Trainer';
    }

    function updateSummary(visible, allFiltered) {
        const subtitle = document.getElementById('panel-subtitle');
        const mobileSubtitle = document.getElementById('mobile-subtitle');
        const text = state.filters.radius !== 'all' && state.userLocation
            ? `${visible.length} trainers within ${state.filters.radius} km`
            : `${visible.length} trainers visible`;

        if (subtitle) subtitle.textContent = text;
        if (mobileSubtitle) mobileSubtitle.textContent = text;
    }

    function updateStatus(visible, allFiltered) {
        const nearest = state.userLocation && state.nearestTrainerId
            ? state.trainers.find(item => item.id === state.nearestTrainerId)
            : null;

        if (nearest) {
            setStatus(`Nearest trainer: ${nearest.name}`);
            return;
        }

        if (state.loadingTrainers) {
            setStatus('Loading trainer locations...');
            return;
        }

        const mode = state.userLocation ? 'Location enabled' : `Defaulting to ${state.centerLabel}`;
        const status = visible.length
            ? `${visible.length} trainers on map. ${mode}.`
            : `No trainers in the current view. ${mode}.`;
        setStatus(status);
    }

    function setStatus(text) {
        const status = document.getElementById('map-status');
        if (status) status.textContent = text;
    }

    function fitVisibleTrainers() {
        if (!state.map) return;
        const trainers = state.visibleTrainers.length ? state.visibleTrainers : filterTrainers(state.trainers);
        if (!trainers.length) return;

        const bounds = new maplibregl.LngLatBounds();
        trainers.forEach(trainer => bounds.extend([trainer.longitude, trainer.latitude]));
        if (!bounds.isEmpty()) {
            state.map.fitBounds(bounds, { padding: 80, duration: 800 });
        }
    }

    async function openTrainerPopupAfterRender() {
        if (!state.nearestTrainerId) return;
        openTrainerPopup(state.nearestTrainerId);
    }

    function haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const toRad = v => v * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function formatPrice(price) {
        const value = Number(price);
        if (!Number.isFinite(value)) return null;
        return new Intl.NumberFormat('en-IN', {
            maximumFractionDigits: 0
        }).format(value);
    }

    function renderPriceLabel(price) {
        const formatted = formatPrice(price);
        if (!formatted) return 'View pricing';
        return `₹${formatted}<span class="text-xs font-semibold text-on-surface-variant">/hr</span>`;
    }

    function emptyCollection() {
        return { type: 'FeatureCollection', features: [] };
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function escapeAttr(value) {
        return escapeHtml(value).replaceAll('`', '&#096;');
    }
})();
