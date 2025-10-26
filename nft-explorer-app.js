// --- Global Elements ---
const gallery = document.getElementById('nft-gallery');
const paginationControls = document.getElementById('pagination-controls');
const searchInput = document.getElementById('search-id');
const searchAddressInput = document.getElementById('search-address');
const addressDropdown = document.getElementById('address-dropdown');
const sortSelect = document.getElementById('sort-rank');
const traitFiltersContainer = document.getElementById('trait-filters-container');
const inhabitantFiltersContainer = document.getElementById('inhabitant-filters-container');
const planetFiltersContainer = document.getElementById('planet-filters-container');
const statusFiltersGrid = document.getElementById('status-filters-grid');
const mintStatusContainer = document.getElementById('mint-status-container');
const traitTogglesContainer = document.getElementById('trait-toggles-container');
const resetButton = document.getElementById('reset-filters');
const resultsCount = document.getElementById('results-count');
const nftModal = document.getElementById('nft-modal');
const modalCloseBtn = document.getElementById('modal-close');
const rarityModal = document.getElementById('rarity-modal');
const rarityExplainedBtn = document.getElementById('rarity-explained-btn');
const rarityModalCloseBtn = document.getElementById('rarity-modal-close');
const badgeModal = document.getElementById('badge-modal');
const badgesExplainedBtn = document.getElementById('badges-explained-btn');
const badgeModalCloseBtn = document.getElementById('badge-modal-close');
const collectionViewBtn = document.getElementById('collection-view-btn');
const walletViewBtn = document.getElementById('wallet-view-btn');
const mapViewBtn = document.getElementById('map-view-btn');
const collectionView = document.getElementById('collection-view');
const walletView = document.getElementById('wallet-view');
const mapView = document.getElementById('map-view');
const walletSearchAddressInput = document.getElementById('wallet-search-address');
const walletCopyAddressBtn = document.getElementById('wallet-copy-address-btn');
const walletAddressSuggestions = document.getElementById('wallet-address-suggestions');
const walletResetBtn = document.getElementById('wallet-reset-btn');
const leaderboardTable = document.getElementById('leaderboard-table');
const leaderboardPagination = document.getElementById('leaderboard-pagination');
const walletTraitTogglesContainer = document.getElementById('wallet-trait-toggles-container');
const walletGallery = document.getElementById('wallet-gallery');
const walletGalleryTitle = document.getElementById('wallet-gallery-title');
const addressSuggestions = document.getElementById('address-suggestions');
const copyAddressBtn = document.getElementById('copy-address-btn');
const copyToast = document.getElementById('copy-toast');
const walletExplorerModal = document.getElementById('wallet-explorer-modal');
const walletModalCloseBtn = document.getElementById('wallet-modal-close');
const systemLeaderboardModal = document.getElementById('system-leaderboard-modal');
const systemModalCloseBtn = document.getElementById('system-modal-close');


// --- Config ---
const METADATA_URL = "https://cdn.jsdelivr.net/gh/defipatriot/nft-metadata/all_nfts_metadata.json";
const STATUS_DATA_URL = "https://deving.zone/en/nfts/alliance_daos.json";
const DAO_WALLET_ADDRESS = "terra1sffd4efk2jpdt894r04qwmtjqrrjfc52tmj6vkzjxqhd8qqu2drs3m5vzm";
const itemsPerPage = 20;
const traitOrder = ["Rank", "Rarity", "Planet", "Inhabitant", "Object", "Weather", "Light"];
const filterLayoutOrder = ["Rarity", "Object", "Weather", "Light"];
const defaultTraitsOn = ["Rank", "Planet", "Inhabitant", "Object"];

// --- State ---
let allNfts = [];
let filteredNfts = [];
let currentPage = 1;
let traitCounts = {};
let inhabitantCounts = {};
let planetCounts = {};
let ownerAddresses = [];
let allHolderStats = [];
let holderCurrentPage = 1;
const holdersPerPage = 10;
let holderSort = { column: 'total', direction: 'desc' };
let globalAnimationFrameId; // For stopping the map animation

// --- Utility Functions ---
const debounce = (func, delay) => { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; };
const showLoading = (container, message) => { container.innerHTML = `<p class="text-center col-span-full text-cyan-400 text-lg">${message}</p>`; };
const showError = (container, message) => { container.innerHTML = `<div class="text-center col-span-full bg-red-900/50 border border-red-700 text-white p-6 rounded-lg"><h3 class="font-bold text-xl">Error</h3><p class="mt-2 text-red-300">${message}</p></div>`; };
function convertIpfsUrl(ipfsUrl) { if (!ipfsUrl || !ipfsUrl.startsWith('ipfs://')) return ''; return `https://dweb.link/ipfs/${ipfsUrl.replace('ipfs://', '')}`; }

// --- Data Fetching and Processing ---
const mergeNftData = (metadata, statusData) => {
    const statusMap = new Map(statusData.nfts.map(nft => [String(nft.id), nft]));
    return metadata.map(nft => {
        const status = statusMap.get(String(nft.id));
        if (status) {
            // Map new data structure to the one used throughout the app
            return {
                ...nft,
                owner: status.owner,
                broken: status.broken,
                staked_daodao: status.daodao,
                staked_enterprise_legacy: status.enterprise,
                bbl_market: status.bbl,
                boost_market: status.boost,
                liquid: status.liquid
            };
        }
        return nft;
    });
};

const initializeExplorer = async () => {
    showLoading(gallery, 'Loading collection metadata...');
    showLoading(leaderboardTable, 'Loading holder data...');
    showLoading(walletGallery, 'Search for or select a wallet to see owned NFTs.');
    try {
        const [metaResponse, statusResponse] = await Promise.all([
            fetch(METADATA_URL),
            fetch(STATUS_DATA_URL) 
        ]);

        if (!metaResponse.ok) throw new Error(`Metadata network response was not ok: ${metaResponse.status}`);
        if (!statusResponse.ok) throw new Error(`Status data network response was not ok: ${statusResponse.status}`);
        
        const metadata = await metaResponse.json();
        const statusData = await statusResponse.json();

        if (!Array.isArray(metadata) || metadata.length === 0) { showError(gallery, "Metadata is empty or in the wrong format."); return; }
        
        allNfts = mergeNftData(metadata, statusData);

        calculateRanks();
        populateTraitFilters();
        populateInhabitantFilters();
        populatePlanetFilters();
        populateStatusFilters();
        populateTraitToggles();
        populateWalletTraitToggles();
        setupAddressFeatures();
        updateFilterCounts(allNfts);
        addAllEventListeners();
        applyStateFromUrl();
        applyFiltersAndSort();
        calculateAndDisplayLeaderboard();

    } catch (error) {
        console.error("Failed to initialize explorer:", error);
        showError(gallery, `Could not load or process NFT data. Error: ${error.message}`);
        showError(leaderboardTable, 'Could not load data.');
        showError(walletGallery, 'Could not load data.');
    }
};

const calculateRanks = () => {
    traitCounts = {};
    inhabitantCounts = {};
    planetCounts = {};
    allNfts.forEach(nft => {
        if (nft.attributes) {
            nft.attributes.forEach(attr => {
                if (!traitCounts[attr.trait_type]) traitCounts[attr.trait_type] = {};
                traitCounts[attr.trait_type][attr.value] = (traitCounts[attr.trait_type][attr.value] || 0) + 1;
                
                if (attr.trait_type === 'Inhabitant') {
                    const baseName = attr.value.replace(/ (M|F)$/, '');
                    if (!inhabitantCounts[baseName]) inhabitantCounts[baseName] = { total: 0, male: 0, female: 0 };
                    inhabitantCounts[baseName].total++;
                    if (attr.value.endsWith(' M')) inhabitantCounts[baseName].male++;
                    if (attr.value.endsWith(' F')) inhabitantCounts[baseName].female++;
                }
                if (attr.trait_type === 'Planet') {
                    const baseName = attr.value.replace(/ (North|South)$/, '');
                    if (!planetCounts[baseName]) planetCounts[baseName] = { total: 0, north: 0, south: 0 };
                    planetCounts[baseName].total++;
                    if (attr.value.endsWith(' North')) planetCounts[baseName].north++;
                    if (attr.value.endsWith(' South')) planetCounts[baseName].south++;
                }
            });
        }
    });

    allNfts.forEach(nft => {
        let totalScore = 0;
        if (nft.attributes) {
            nft.attributes.forEach(attr => {
                if (attr.trait_type !== 'Weather' && attr.trait_type !== 'Light') {
                    const count = traitCounts[attr.trait_type][attr.value];
                    totalScore += 1 / (count / allNfts.length);
                }
            });
        }
        nft.rarityScore = totalScore;
    });

    allNfts.sort((a, b) => b.rarityScore - a.rarityScore);

    allNfts.forEach((nft, index) => {
        nft.rank = index + 1;
    });
};

// --- UI Population ---
 const createFilterItem = (config) => {
    const container = document.createElement('div');
    container.className = 'flex items-center justify-between';
    
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-label';
    toggleLabel.innerHTML = `<input type="checkbox" class="toggle-checkbox ${config.toggleClass}" data-key="${config.key}"><span class="toggle-switch mr-2"></span><span class="font-medium">${config.label}</span>`;
    
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'flex flex-col items-center';
    sliderContainer.innerHTML = `<span class="text-xs text-gray-400 h-4 ${config.countClass || ''}" data-count-key="${config.key}">${config.initialCount || '0'}</span><div class="direction-slider-container"><span class="text-xs text-gray-400">${config.left}</span><input type="range" min="0" max="2" value="1" class="direction-slider ${config.sliderClass}" data-slider-key="${config.key}" disabled><span class="text-xs text-gray-400">${config.right}</span></div>`;
    
    container.appendChild(toggleLabel);
    container.appendChild(sliderContainer);
    return container;
};

const populateInhabitantFilters = () => {
    inhabitantFiltersContainer.innerHTML = '';
    const uniqueInhabitants = Object.keys(inhabitantCounts).sort();
    uniqueInhabitants.forEach(name => {
        const container = createFilterItem({
            toggleClass: 'inhabitant-toggle-cb', key: name, label: name,
            countClass: 'inhabitant-count', initialCount: inhabitantCounts[name].total,
            sliderClass: 'gender-slider', left: 'M', right: 'F'
        });
        inhabitantFiltersContainer.appendChild(container);
        container.addEventListener('mouseenter', (e) => showPreviewTile(e, 'Inhabitant', name));
        container.addEventListener('mouseleave', hidePreviewTile);
    });
};

const populatePlanetFilters = () => {
    planetFiltersContainer.innerHTML = '';
    const planetNames = Object.keys(planetCounts).sort();
    planetNames.forEach(name => {
        const container = createFilterItem({
            toggleClass: 'planet-toggle-cb', key: name, label: name,
            countClass: 'planet-count', initialCount: planetCounts[name].total,
            sliderClass: 'planet-slider', left: 'N', right: 'S'
        });
        planetFiltersContainer.appendChild(container);
        container.addEventListener('mouseenter', (e) => showPreviewTile(e, 'Planet', name));
        container.addEventListener('mouseleave', hidePreviewTile);
    });
};

const populateTraitFilters = () => {
    traitFiltersContainer.innerHTML = '';

    const createMultiSelect = (traitType, values) => {
        const container = document.createElement('div');
        container.className = 'multi-select-container';
        let optionsHtml = '';
        values.forEach(value => {
            const style = value === 'Phoenix Rising' ? 'style="color: #f97316; font-weight: bold;"' : '';
            optionsHtml += `<label ${style}><input type="checkbox" class="multi-select-checkbox" data-trait="${traitType}" value="${value}"> <span class="trait-value">${value}</span> (<span class="trait-count">0</span>)</label>`;
        });
        container.innerHTML = `<label class="block text-sm font-medium text-gray-300 mb-1">${traitType}</label><button type="button" class="multi-select-button"><span>All ${traitType}s</span><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></button><div class="multi-select-dropdown hidden">${optionsHtml}</div>`;
        const button = container.querySelector('.multi-select-button');
        const dropdown = container.querySelector('.multi-select-dropdown');
        button.addEventListener('click', (e) => { e.stopPropagation(); closeAllDropdowns(dropdown); dropdown.classList.toggle('hidden'); });
        dropdown.addEventListener('change', () => { updateMultiSelectButtonText(container); handleFilterChange(); });

        if (traitType === 'Object') {
            dropdown.querySelectorAll('label').forEach(label => {
                const checkbox = label.querySelector('input');
                label.addEventListener('mouseenter', (e) => showPreviewTile(e, 'Object', checkbox.value));
                label.addEventListener('mouseleave', hidePreviewTile);
            });
        }
        return container;
    };

    filterLayoutOrder.forEach(traitType => {
        let values;
        if (traitType === 'Rarity') {
            values = Object.keys(traitCounts[traitType] || {}).sort((a, b) => Number(b) - Number(a));
        } else {
             values = Object.keys(traitCounts[traitType] || {}).sort();
        }
        
        if (traitType === 'Object' || traitType === 'Weather' || traitType === 'Light') {
            values.sort((a, b) => traitCounts[traitType][a] - traitCounts[traitType][b]);
        }
        if (traitType === 'Object') {
            const phoenixIndex = values.indexOf('Phoenix Rising');
            if (phoenixIndex > -1) { const [phoenixRising] = values.splice(phoenixIndex, 1); values.unshift(phoenixRising); }
        }
        traitFiltersContainer.appendChild(createMultiSelect(traitType, values));
    });
};

const populateStatusFilters = () => {
    statusFiltersGrid.innerHTML = '';
    const statusFilterConfig = [
        { key: 'staked', label: 'Staked', left: 'Enterprise', right: 'DAODAO' },
        { key: 'listed', label: 'Listed', left: 'Boost', right: 'BackBoneLabs' },
        { key: 'rewards', label: 'Rewards', left: 'Broken', right: 'Unbroken' }
    ];

    statusFilterConfig.forEach(filter => {
        const container = createFilterItem({
            toggleClass: 'status-toggle-cb', key: filter.key, label: filter.label,
            countClass: 'status-count',
            sliderClass: 'status-slider', left: filter.left, right: filter.right
        });
         statusFiltersGrid.appendChild(container);
    });

    mintStatusContainer.innerHTML = ''; // Clear previous content
    const mintStatusFilter = createFilterItem({
        toggleClass: 'status-toggle-cb', key: 'mint_status', label: 'Mint Status',
        countClass: 'status-count',
        sliderClass: 'status-slider', left: 'Un-Minted', right: 'Minted'
    });
    mintStatusContainer.appendChild(mintStatusFilter);

    const liquidStatusFilter = createFilterItem({
        toggleClass: 'status-toggle-cb', key: 'liquid_status', label: 'Liquid Status',
        countClass: 'status-count',
        sliderClass: 'status-slider', left: 'Liquid', right: 'Not Liquid'
    });
    mintStatusContainer.parentElement.appendChild(liquidStatusFilter);
};

const populateTraitToggles = () => {
    traitTogglesContainer.innerHTML = '';
    traitOrder.forEach(traitType => {
        const label = document.createElement('label');
        label.className = 'toggle-label';
        label.innerHTML = `<input type="checkbox" class="toggle-checkbox trait-toggle" data-trait="${traitType}" ${defaultTraitsOn.includes(traitType) ? 'checked' : ''}><span class="toggle-switch mr-2"></span><span>${traitType}</span>`;
        traitTogglesContainer.appendChild(label);
    });
};

const populateWalletTraitToggles = () => {
    walletTraitTogglesContainer.innerHTML = '';
    const walletTraits = ["Rank", "Planet", "Inhabitant", "Object"];
    walletTraits.forEach(traitType => {
        const label = document.createElement('label');
        label.className = 'toggle-label';
        label.innerHTML = `<input type="checkbox" class="toggle-checkbox wallet-trait-toggle" data-trait="${traitType}" checked><span class="toggle-switch mr-2"></span><span>${traitType}</span>`;
        walletTraitTogglesContainer.appendChild(label);
    });
};

const addAllEventListeners = () => {
     // ... existing listeners ...

    // --- View Switching Listeners (PERFORMANCE FIX & RENDER TIMING FIX ADDED) ---
    collectionViewBtn.addEventListener('click', () => {
        if (globalAnimationFrameId) cancelAnimationFrame(globalAnimationFrameId); // Stop map animation
        isMapInitialized = false; // Reset map initialization flag
        collectionView.classList.remove('hidden');
        walletView.classList.add('hidden');
        mapView.classList.add('hidden');
        collectionViewBtn.classList.add('active');
        walletViewBtn.classList.remove('active');
        mapViewBtn.classList.remove('active');
    });

    walletViewBtn.addEventListener('click', () => {
        if (globalAnimationFrameId) cancelAnimationFrame(globalAnimationFrameId); // Stop map animation
        isMapInitialized = false; // Reset map initialization flag
        walletView.classList.remove('hidden');
        collectionView.classList.add('hidden');
        mapView.classList.add('hidden');
        walletViewBtn.classList.add('active');
        collectionViewBtn.classList.remove('active');
        mapViewBtn.classList.remove('active');
    });

     mapViewBtn.addEventListener('click', () => {
        // Make the map view visible FIRST
        mapView.classList.remove('hidden');
        collectionView.classList.add('hidden');
        walletView.classList.add('hidden');
        mapViewBtn.classList.add('active');
        collectionViewBtn.classList.remove('active');
        walletViewBtn.classList.remove('active');
        
        // Use requestAnimationFrame to ensure the browser has rendered the view
        // and calculated canvas dimensions BEFORE initializing the starfield.
        requestAnimationFrame(() => {
            initializeStarfield(); // Start map animation only after render
        });
    });

    // ... rest of existing listeners ...
};

const setupAddressFeatures = () => {
    // 1. Calculate NFT counts for each owner
    const ownerCounts = {};
    allNfts.forEach(nft => {
        if (nft.owner) {
            ownerCounts[nft.owner] = (ownerCounts[nft.owner] || 0) + 1;
        }
    });

    // 2. Sort owners by count, descending
    const sortedOwners = Object.entries(ownerCounts)
        .sort(([, countA], [, countB]) => countB - countA);

    // 3. Populate collection dropdown
    addressDropdown.innerHTML = '<option value="">Holders</option>';
    sortedOwners.forEach(([address, count]) => {
        const option = document.createElement('option');
        option.value = address;
        option.textContent = `(${count}) ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        addressDropdown.appendChild(option);
    });
    
    // 4. Store the master list of addresses (just the addresses) for the live search feature
    ownerAddresses = sortedOwners.map(([address]) => address);
};

// --- Collection View Logic ---
const applyFiltersAndSort = () => {
    let tempNfts = [...allNfts];

    // Address Search
    const addressSearchTerm = searchAddressInput.value.trim().toLowerCase();
    if(addressSearchTerm) {
        tempNfts = tempNfts.filter(nft => nft.owner && nft.owner.toLowerCase().includes(addressSearchTerm));
    }
    
    // --- Status Filters ---
    if (document.querySelector('.status-toggle-cb[data-key="staked"]').checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="staked"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.staked_enterprise_legacy);
        else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.staked_enterprise_legacy || nft.staked_daodao);
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.staked_daodao);
    }
    if (document.querySelector('.status-toggle-cb[data-key="listed"]').checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="listed"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.boost_market);
        else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.boost_market || nft.bbl_market);
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.bbl_market);
    }
    if (document.querySelector('.status-toggle-cb[data-key="rewards"]').checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="rewards"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.broken === true);
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.broken === false);
    }
    if (document.querySelector('.status-toggle-cb[data-key="liquid_status"]').checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="liquid_status"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.liquid === true);
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.liquid === false);
    }
     if (document.querySelector('.status-toggle-cb[data-key="mint_status"]').checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="mint_status"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.owner === DAO_WALLET_ADDRESS);
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.owner !== DAO_WALLET_ADDRESS);
    }

    const activePlanetFilters = [];
    document.querySelectorAll('.planet-toggle-cb:checked').forEach(cb => {
        const planetName = cb.dataset.key;
        const slider = document.querySelector(`.direction-slider[data-slider-key="${planetName}"]`);
        activePlanetFilters.push({ name: planetName, direction: slider.value });
    });
    if (activePlanetFilters.length > 0) {
        tempNfts = tempNfts.filter(nft => {
            const planetAttr = nft.attributes?.find(a => a.trait_type === 'Planet');
            if (!planetAttr) return false;
            return activePlanetFilters.some(filter => {
                const planetValue = planetAttr.value;
                if (filter.direction === '1') return planetValue.startsWith(filter.name);
                if (filter.direction === '0') return planetValue === `${filter.name} North`;
                if (filter.direction === '2') return planetValue === `${filter.name} South`;
                return false;
            });
        });
    }

    const activeInhabitantFilters = [];
    document.querySelectorAll('.inhabitant-toggle-cb:checked').forEach(cb => {
        const inhabitantName = cb.dataset.key;
        const slider = document.querySelector(`.gender-slider[data-slider-key="${inhabitantName}"]`);
        activeInhabitantFilters.push({ name: inhabitantName, gender: slider.value });
    });
    if (activeInhabitantFilters.length > 0) {
        tempNfts = tempNfts.filter(nft => {
            const inhabitantAttr = nft.attributes?.find(a => a.trait_type === 'Inhabitant');
            if (!inhabitantAttr) return false;
            return activeInhabitantFilters.some(filter => {
                if (!inhabitantAttr.value.startsWith(filter.name)) return false;
                if (filter.gender === '1') return true;
                if (filter.gender === '0') return inhabitantAttr.value.endsWith(' M');
                if (filter.gender === '2') return inhabitantAttr.value.endsWith(' F');
                return false;
            });
        });
    }
    
    const searchTerm = searchInput.value;
    if (searchTerm) tempNfts = tempNfts.filter(nft => nft.id.toString() === searchTerm);
    
    document.querySelectorAll('.multi-select-container').forEach(container => {
        const traitElement = container.querySelector('[data-trait]');
        if (!traitElement) return;
        const trait = traitElement.dataset.trait;
        let selectedValues = [];
        container.querySelectorAll('.multi-select-checkbox:checked').forEach(cb => selectedValues.push(cb.value));
        if (selectedValues.length === 0) return;
        tempNfts = tempNfts.filter(nft => nft.attributes?.some(attr => attr.trait_type === trait && selectedValues.includes(attr.value.toString())));
    });

    const sortValue = sortSelect.value;
    if (sortValue === 'asc') tempNfts.sort((a, b) => a.rank - b.rank);
    else if (sortValue === 'desc') tempNfts.sort((a, b) => b.rank - a.rank);
    else if (sortValue === 'id') tempNfts.sort((a, b) => a.id - b.id);

    filteredNfts = tempNfts;
    resultsCount.textContent = filteredNfts.length;
    updateFilterCounts();
    displayPage(1);
};

const handleFilterChange = () => { applyFiltersAndSort(); updateUrlState(); };

const updateUrlState = () => {
    const params = new URLSearchParams();
    if (searchAddressInput.value) params.set('address', searchAddressInput.value);
    if (searchInput.value) params.set('id', searchInput.value);
    if (sortSelect.value !== 'asc') params.set('sort', sortSelect.value);

    document.querySelectorAll('.multi-select-container').forEach(container => {
        const traitElement = container.querySelector('[data-trait]');
        if (!traitElement) return;
        const trait = traitElement.dataset.trait;
        let selectedValues = [];
        container.querySelectorAll('.multi-select-checkbox:checked').forEach(cb => selectedValues.push(cb.value));
        if (selectedValues.length > 0) params.set(trait.toLowerCase(), selectedValues.join(','));
    });

    document.querySelectorAll('.toggle-checkbox:checked').forEach(toggle => {
        params.set(toggle.dataset.key, 'true');
        const slider = document.querySelector(`.direction-slider[data-slider-key="${toggle.dataset.key}"]`);
        if(slider) {
            params.set(`${toggle.dataset.key}_pos`, slider.value);
        }
    });
    
    try {
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        history.pushState({}, '', newUrl);
    } catch (e) { console.warn("Could not update URL state."); }
};

const applyStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    searchInput.value = params.get('id') || '';
    searchAddressInput.value = params.get('address') || '';
    sortSelect.value = params.get('sort') || 'asc';
    
    document.querySelectorAll('.multi-select-container').forEach(container => {
        const traitElement = container.querySelector('[data-trait]');
        if (!traitElement) return;
        const trait = traitElement.dataset.trait.toLowerCase();
        if (!params.has(trait)) return;
        const values = params.get(trait).split(',');
        container.querySelectorAll('.multi-select-checkbox').forEach(cb => {
            if (values.includes(cb.value)) cb.checked = true;
        });
        updateMultiSelectButtonText(container);
    });

    document.querySelectorAll('.toggle-checkbox').forEach(toggle => {
        const key = toggle.dataset.key;
        if (params.get(key) === 'true') {
            toggle.checked = true;
            const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`);
            if(slider) {
                slider.disabled = false;
                slider.value = params.get(`${key}_pos`) || '1';
            }
        }
    });
};

const updateMultiSelectButtonText = (container) => {
    const buttonSpan = container.querySelector('.multi-select-button span');
    const traitType = container.querySelector('.multi-select-checkbox').dataset.trait;
    const checkedCount = container.querySelectorAll('.multi-select-checkbox:checked').length;
    buttonSpan.textContent = checkedCount === 0 ? `All ${traitType}s` : `${checkedCount} ${traitType}(s) selected`;
};

const closeAllDropdowns = (exceptThisOne = null) => {
    document.querySelectorAll('.multi-select-dropdown').forEach(d => {
        if (d !== exceptThisOne) d.classList.add('hidden');
    });
    addressSuggestions.classList.add('hidden');
    walletAddressSuggestions.classList.add('hidden');
};

const displayPage = (page) => {
    currentPage = page;
    gallery.innerHTML = '';
    if (filteredNfts.length === 0) {
        showLoading(gallery, 'No NFTs match the current filters.');
        updatePaginationControls(0);
        return;
    }
    const totalPages = Math.ceil(filteredNfts.length / itemsPerPage);
    const pageItems = filteredNfts.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    pageItems.forEach(nft => gallery.appendChild(createNftCard(nft, '.trait-toggle')));
    updatePaginationControls(totalPages);
};

const createNftCard = (nft, toggleSelector) => {
    const card = document.createElement('div');
    card.className = 'nft-card bg-gray-800 border border-gray-700 rounded-xl overflow-hidden flex flex-col';
    card.addEventListener('click', () => showNftDetails(nft));
    const imageUrl = convertIpfsUrl(nft.thumbnail_image || nft.image);
    const newTitle = nft.name.replace('The AllianceDAO NFT', 'AllianceDAO NFT');

    let traitsHtml = '';
    const visibleTraits = traitOrder.filter(t => document.querySelector(`${toggleSelector}[data-trait="${t}"]`)?.checked);
    visibleTraits.forEach(traitType => {
        let value = traitType === 'Rank' ? `#${nft.rank}` : nft.attributes?.find(attr => attr.trait_type === traitType)?.value || 'N/A';
        traitsHtml += `<li class="flex justify-between items-center py-2 px-1 border-b border-gray-700 last:border-b-0"><span class="text-xs font-medium text-cyan-400 uppercase">${traitType}</span><span class="text-sm font-semibold text-white">${value}</span></li>`;
    });
    
    card.innerHTML = `<div class="image-container aspect-w-1-aspect-h-1 w-full"><img src="${imageUrl}" alt="${nft.name}" class="w-full h-full" loading="lazy" onerror="this.onerror=null; this.src='https://placehold.co/300x300/1f2937/eb?text=Image+Error';"></div><div class="p-4 flex-grow flex flex-col"><h2 class="text-lg font-bold text-white mb-3 truncate" title="${newTitle}">${newTitle}</h2><ul class="text-sm flex-grow">${traitsHtml}</ul></div>`;
    
    const imageContainer = card.querySelector('.image-container');
    
    const isDaoOwned = nft.owner === DAO_WALLET_ADDRESS;
    const hasBadges = nft.broken || nft.staked_daodao || nft.boost_market || nft.bbl_market || nft.staked_enterprise_legacy || isDaoOwned;

    if (hasBadges) {
        // --- Add Badge Visibility Toggle ---
        const toggleButton = document.createElement('button');
        toggleButton.className = 'top-left-toggle';
        toggleButton.title = 'Toggle badge visibility';
        toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`; // Eye icon

        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation(); // IMPORTANT: Prevents the modal from opening
            const isHidden = imageContainer.classList.toggle('badges-hidden');
            if (isHidden) {
                toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`; // Eye-off icon
            } else {
                toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`; // Eye icon
            }
        });
        imageContainer.appendChild(toggleButton);
    }


    if (nft.broken) {
        const brokenBanner = document.createElement('div');
        brokenBanner.className = 'broken-banner';
        brokenBanner.textContent = 'BROKEN';
        imageContainer.appendChild(brokenBanner);
    }

    const topRightStack = document.createElement('div');
    topRightStack.className = 'top-right-stack';

    if (isDaoOwned) {
        const daoLogo = document.createElement('img');
        daoLogo.src = 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/Alliance%20DAO%20Logo.png';
        daoLogo.alt = 'Owned by DAO';
        daoLogo.className = 'overlay-icon';
        topRightStack.appendChild(daoLogo);
    }
    if (nft.staked_daodao) {
        const daodaoLogo = document.createElement('img');
        daodaoLogo.src = 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/DAODAO.png';
        daodaoLogo.alt = 'Staked on DAODAO';
        daodaoLogo.className = 'overlay-icon';
        topRightStack.appendChild(daodaoLogo);
    }
    if (nft.boost_market) {
        const boostLogo = document.createElement('img');
        boostLogo.src = 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/Boost%20Logo.png';
        boostLogo.alt = 'Listed on Boost';
        boostLogo.className = 'overlay-icon';
        topRightStack.appendChild(boostLogo);
    }
    if (nft.bbl_market) {
        const bblLogo = document.createElement('img');
        bblLogo.src = 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/BBL%20No%20Background.png';
        bblLogo.alt = 'Listed on BBL';
        bblLogo.className = 'overlay-icon';
        topRightStack.appendChild(bblLogo);
    }
    if (nft.staked_enterprise_legacy) {
        const enterpriseE = document.createElement('img');
        enterpriseE.src = 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/Enterprise.jpg';
        enterpriseE.alt = 'Staked on Enterprise';
        enterpriseE.className = 'overlay-icon';
        topRightStack.appendChild(enterpriseE);
    }

    if (topRightStack.children.length > 0) {
        imageContainer.appendChild(topRightStack);
    }

    return card;
};

const updatePaginationControls = (totalPages) => {
    paginationControls.innerHTML = '';
    if (totalPages <= 1) return;
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.className = 'pagination-btn';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => displayPage(currentPage - 1);
    paginationControls.appendChild(prevButton);
    const pageInfo = document.createElement('span');
    pageInfo.className = 'text-gray-400';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    paginationControls.appendChild(pageInfo);
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.className = 'pagination-btn';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => displayPage(currentPage + 1);
    paginationControls.appendChild(nextButton);
};

const resetAll = () => {
    searchInput.value = '';
    searchAddressInput.value = '';
    addressDropdown.value = '';
    sortSelect.value = 'asc';
    
    document.querySelectorAll('.toggle-checkbox').forEach(toggle => {
        if(!toggle.classList.contains('trait-toggle')) {
            toggle.checked = false;
            const key = toggle.dataset.key;
            const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`);
            if(slider) {
                slider.value = 1;
                slider.disabled = true;
            }
        }
    });

    document.querySelectorAll('.multi-select-container').forEach(container => {
        container.querySelectorAll('.multi-select-checkbox').forEach(cb => cb.checked = false);
        updateMultiSelectButtonText(container);
    });
    
    document.querySelectorAll('.trait-toggle').forEach(toggle => { toggle.checked = defaultTraitsOn.includes(toggle.dataset.trait); });
    
    handleFilterChange();
};


const updateFilterCounts = () => {
    const newCounts = {};
    filteredNfts.forEach(nft => {
        if (nft.attributes) {
            nft.attributes.forEach(attr => {
                if (!newCounts[attr.trait_type]) newCounts[attr.trait_type] = {};
                newCounts[attr.trait_type][attr.value] = (newCounts[attr.trait_type][attr.value] || 0) + 1;
            });
        }
    });

    document.querySelectorAll('.multi-select-container').forEach(container => {
        const traitType = container.querySelector('[data-trait]').dataset.trait;
        container.querySelectorAll('label').forEach(label => {
            const checkbox = label.querySelector('input');
            if (!checkbox) return;
            const value = checkbox.value;
            const countSpan = label.querySelector('.trait-count');
            const count = newCounts[traitType]?.[value] || 0;
            countSpan.textContent = count;
            if (count === 0 && !checkbox.checked) {
                label.style.opacity = '0.5';
                label.style.cursor = 'not-allowed';
                checkbox.disabled = true;
            } else {
                label.style.opacity = '1';
                label.style.cursor = 'pointer';
                checkbox.disabled = false;
            }
        });
    });

    document.querySelectorAll('.inhabitant-count').forEach(countSpan => {
        const name = countSpan.dataset.countKey;
        const slider = document.querySelector(`.gender-slider[data-slider-key="${name}"]`);
        const maleCount = filteredNfts.filter(nft => nft.attributes?.some(a => a.trait_type === 'Inhabitant' && a.value === `${name} M`)).length;
        const femaleCount = filteredNfts.filter(nft => nft.attributes?.some(a => a.trait_type === 'Inhabitant' && a.value === `${name} F`)).length;
        if (slider.value === '0') countSpan.textContent = maleCount;
        else if (slider.value === '1') countSpan.textContent = maleCount + femaleCount;
        else if (slider.value === '2') countSpan.textContent = femaleCount;
    });

    document.querySelectorAll('.planet-count').forEach(countSpan => {
        const name = countSpan.dataset.countKey;
        const slider = document.querySelector(`.direction-slider[data-slider-key="${name}"]`);
        const northCount = filteredNfts.filter(nft => nft.attributes?.some(a => a.trait_type === 'Planet' && a.value === `${name} North`)).length;
        const southCount = filteredNfts.filter(nft => nft.attributes?.some(a => a.trait_type === 'Planet' && a.value === `${name} South`)).length;
        const totalCount = filteredNfts.filter(nft => nft.attributes?.some(a => a.trait_type === 'Planet' && a.value.startsWith(name))).length;
        if (slider.value === '0') countSpan.textContent = northCount;
        else if (slider.value === '1') countSpan.textContent = totalCount;
        else if (slider.value === '2') countSpan.textContent = southCount;
    });

    // Update Status Filter Counts
    document.querySelectorAll('.status-count').forEach(countSpan => {
        const key = countSpan.dataset.countKey;
        const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`);
        if (!slider) return;

        let count = 0;
        if (key === 'staked') {
             const enterpriseCount = filteredNfts.filter(n => n.staked_enterprise_legacy).length;
             const daodaoCount = filteredNfts.filter(n => n.staked_daodao).length;
             if(slider.value === '0') count = enterpriseCount;
             else if (slider.value === '1') count = filteredNfts.filter(n => n.staked_enterprise_legacy || n.staked_daodao).length;
             else if (slider.value === '2') count = daodaoCount;
        } else if (key === 'listed') {
            const boostCount = filteredNfts.filter(n => n.boost_market).length;
            const bblCount = filteredNfts.filter(n => n.bbl_market).length;
            if(slider.value === '0') count = boostCount;
            else if (slider.value === '1') count = filteredNfts.filter(n => n.boost_market || n.bbl_market).length;
            else if (slider.value === '2') count = bblCount;
        } else if (key === 'rewards') {
             const brokenCount = filteredNfts.filter(n => n.broken).length;
             const unbrokenCount = filteredNfts.filter(n => !n.broken).length;
             if(slider.value === '0') count = brokenCount;
             else if (slider.value === '1') count = brokenCount + unbrokenCount;
             else if (slider.value === '2') count = unbrokenCount;
        } else if (key === 'liquid_status') {
            const liquidCount = filteredNfts.filter(n => n.liquid).length;
            const notLiquidCount = filteredNfts.filter(n => !n.liquid).length;
            if(slider.value === '0') count = liquidCount;
            else if (slider.value === '1') count = liquidCount + notLiquidCount;
            else if (slider.value === '2') count = notLiquidCount;
        } else if (key === 'mint_status') {
            const unmintedCount = filteredNfts.filter(n => n.owner === DAO_WALLET_ADDRESS).length;
            const mintedCount = filteredNfts.filter(n => n.owner !== DAO_WALLET_ADDRESS).length;
            if(slider.value === '0') count = unmintedCount;
            else if (slider.value === '1') count = unmintedCount + mintedCount;
            else if (slider.value === '2') count = mintedCount;
        }
        countSpan.textContent = count;
    });
};

// --- Modal and Preview Logic ---
const findHighestRaritySample = (filterFn) => {
    return allNfts.filter(filterFn).sort((a, b) => b.rarityScore - a.rarityScore)[0];
};

const showPreviewTile = (event, traitType, value) => {
    const previewTile = document.getElementById('preview-tile');
    const container1 = document.getElementById('preview-container-1');
    const image1 = document.getElementById('preview-image-1');
    const name1 = document.getElementById('preview-name-1');
    const container2 = document.getElementById('preview-container-2');
    const image2 = document.getElementById('preview-image-2');
    const name2 = document.getElementById('preview-name-2');
    let sample1 = null, sample2 = null;
    if (traitType === 'Object') {
        sample1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === 'Object' && a.value === value));
    } else if (traitType === 'Inhabitant' || traitType === 'Planet') {
        const slider = event.currentTarget.querySelector('input[type="range"]');
        const sliderValue = slider ? slider.value : '1';
        if (sliderValue === '1') {
            const suffix1 = traitType === 'Inhabitant' ? ' M' : ' North';
            const suffix2 = traitType === 'Inhabitant' ? ' F' : ' South';
            sample1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suffix1));
            sample2 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suffix2));
            if (!sample1) sample1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value.startsWith(value)));
        } else {
            const suffix = (traitType === 'Inhabitant' ? (sliderValue === '0' ? ' M' : ' F') : (sliderValue === '0' ? ' North' : ' South'));
            sample1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suffix));
        }
    }
    if (sample1) {
        image1.src = convertIpfsUrl(sample1.thumbnail_image || sample1.image);
        name1.textContent = sample1.attributes?.find(a => a.trait_type === traitType)?.value || value;
        container1.classList.remove('hidden');
    } else { container1.classList.add('hidden'); }
    if (sample2) {
        image2.src = convertIpfsUrl(sample2.thumbnail_image || sample2.image);
        name2.textContent = sample2.attributes?.find(a => a.trait_type === traitType)?.value || value;
        container2.classList.remove('hidden');
    } else { container2.classList.add('hidden'); }

    if (sample1 || sample2) {
        const tileWidth = sample2 ? 330 : 160;
        let x = event.clientX + 20;
        let y = event.clientY + 10;
        if (x + tileWidth > window.innerWidth) { x = event.clientX - tileWidth - 20; }
        previewTile.style.left = `${x}px`;
        previewTile.style.top = `${y}px`;
        previewTile.classList.remove('hidden');
    }
};

const hidePreviewTile = () => document.getElementById('preview-tile').classList.add('hidden');

const showCopyToast = (text) => {
    copyToast.textContent = text;
    copyToast.classList.add('show');
    setTimeout(() => { copyToast.classList.remove('show'); }, 2000);
}

const copyToClipboard = (textToCopy, typeName = 'Address') => {
    if (!textToCopy) return;
    const tempInput = document.createElement('input');
    tempInput.value = textToCopy;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    const shortText = `${textToCopy.substring(0, 5)}...${textToCopy.substring(textToCopy.length - 5)}`;
    showCopyToast(`Copied ${typeName}: ${shortText}`);
};


const showNftDetails = (nft) => {
    document.getElementById('modal-image').src = convertIpfsUrl(nft.image);
    document.getElementById('modal-title').textContent = nft.name.replace('The AllianceDAO NFT', 'AllianceDAO NFT');
    
    let traitsHtml = `<div class="flex justify-between text-sm"><span class="text-gray-400">Rank:</span><span class="font-semibold text-white">#${nft.rank}</span></div>`;
    traitsHtml += nft.attributes
        .sort((a, b) => traitOrder.indexOf(a.trait_type) - traitOrder.indexOf(b.trait_type))
        .map(attr => `<div class="flex justify-between text-sm"><span class="text-gray-400">${attr.trait_type}:</span><span class="font-semibold text-white">${attr.value}</span></div>`).join('');
    
    traitsHtml += `<div class="pt-2 mt-2 border-t border-gray-600"></div>`;
    const isStaked = nft.staked_daodao || nft.staked_enterprise_legacy;
    const isListed = nft.bbl_market || nft.boost_market;
    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Status:</span><span class="font-semibold text-white">${nft.liquid ? 'Liquid' : (isStaked ? 'Staked' : 'In Wallet')}</span></div>`;
    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Listed:</span><span class="font-semibold text-white">${isListed ? 'Yes' : 'No'}</span></div>`;
    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Broken:</span><span class="font-semibold text-white">${nft.broken ? 'Yes' : 'No'}</span></div>`;
    traitsHtml += `<div class="pt-2 mt-2 border-t border-gray-600"></div>`;
    traitsHtml += `<div class="flex justify-between text-sm items-center"><span class="text-gray-400">Owner:</span><span class="owner-address font-mono text-sm font-semibold text-white truncate cursor-pointer" title="Click to copy">${nft.owner}</span></div>`;

    const modalTraits = document.getElementById('modal-traits');
    modalTraits.innerHTML = traitsHtml;
    modalTraits.querySelector('.owner-address').addEventListener('click', () => copyToClipboard(nft.owner, 'Owner Address'));

    document.getElementById('modal-link').href = convertIpfsUrl(nft.image);
    
    const downloadBtn = document.getElementById('download-post-btn');
    downloadBtn.textContent = 'Download Post';
    downloadBtn.onclick = () => generateShareImage(nft, downloadBtn);

    nftModal.classList.remove('hidden');
};

const hideNftDetails = () => nftModal.classList.add('hidden');

const findRarestTrait = (nft) => {
    if (!nft.attributes || !traitCounts) return { value: 'N/A', trait_type: 'Unknown' };

    let rarestTrait = null;
    let minCount = Infinity;

    nft.attributes.forEach(attr => {
        if (attr.trait_type !== 'Weather' && attr.trait_type !== 'Light') {
            const count = traitCounts[attr.trait_type]?.[attr.value];
            if (count < minCount) {
                minCount = count;
                rarestTrait = attr;
            }
        }
    });
    return rarestTrait || { value: 'N/A', trait_type: 'Unknown' };
};

const generateShareImage = (nft, button) => {
    button.textContent = 'Generating...';
    const canvas = document.getElementById('share-canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = convertIpfsUrl(nft.image);

    img.onload = () => {
        canvas.width = 1080; canvas.height = 1080;
        ctx.drawImage(img, 0, 0, 1080, 1080);
        const getTrait = (type) => nft.attributes?.find(a => a.trait_type === type)?.value || 'N/A';
        ctx.fillStyle = 'white'; ctx.strokeStyle = 'black';
        ctx.lineWidth = 8; ctx.font = 'bold 48px Inter, sans-serif';
        const margin = 40;
        ctx.textAlign = 'left';
        ctx.strokeText(`NFT #${nft.id}`, margin, margin + 48);
        ctx.fillText(`NFT #${nft.id}`, margin, margin + 48);
        ctx.textAlign = 'right';
        ctx.strokeText(`Rank #${nft.rank}`, canvas.width - margin, margin + 48);
        ctx.fillText(`Rank #${nft.rank}`, canvas.width - margin, margin + 48);
        ctx.textAlign = 'left';
        ctx.strokeText(getTrait('Planet'), margin, canvas.height - margin);
        ctx.fillText(getTrait('Planet'), margin, canvas.height - margin);
        ctx.textAlign = 'right';
        let inhabitantText = getTrait('Inhabitant');
        if (inhabitantText.endsWith(' M')) inhabitantText = inhabitantText.replace(' M', ' Male');
        else if (inhabitantText.endsWith(' F')) inhabitantText = inhabitantText.replace(' F', ' Female');
        ctx.strokeText(inhabitantText, canvas.width - margin, canvas.height - margin);
        ctx.fillText(inhabitantText, canvas.width - margin, canvas.height - margin);
        const bannerHeight = 120;

        if (nft.broken) {
            ctx.fillStyle = 'rgba(220, 38, 38, 0.85)'; // Red from .broken-banner
            ctx.fillRect(0, canvas.height - bannerHeight - 80, canvas.width, bannerHeight);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.font = 'bold 60px Inter, sans-serif';
            ctx.fillText('BROKEN', canvas.width / 2, canvas.height - bannerHeight - 80 + 85);
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, canvas.height - bannerHeight - 80, canvas.width, bannerHeight);
            const strength = findRarestTrait(nft);
            ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = 'bold 40px Inter, sans-serif';
            ctx.fillText(`Strength: ${strength.value}`, canvas.width / 2, canvas.height - bannerHeight - 80 + 75);
        }

        const link = document.createElement('a');
        link.download = `AllianceDAO_NFT_${nft.id}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        button.textContent = 'Download Post';
    };
    img.onerror = () => {
        console.error("Could not load image to generate post for download.");
        button.textContent = 'Error';
        setTimeout(() => { button.textContent = 'Download Post'; }, 2000);
    }
};

// --- Wallet View Logic ---
const calculateAndDisplayLeaderboard = () => {
    if (allNfts.length === 0) return;

    const ownerStats = {};
    allNfts.forEach(nft => {
        if (nft.owner) {
            if (!ownerStats[nft.owner]) {
                 ownerStats[nft.owner] = { address: nft.owner, total: 0, daodaoStaked: 0, enterpriseStaked: 0, broken: 0, unbroken: 0, bblListed: 0, boostListed: 0 };
            }
            const stats = ownerStats[nft.owner];
            stats.total++;
            if (nft.staked_daodao) stats.daodaoStaked++;
            if (nft.staked_enterprise_legacy) stats.enterpriseStaked++;
            if (nft.bbl_market) stats.bblListed++;
            if (nft.boost_market) stats.boostListed++;
            if (nft.broken) stats.broken++;
            else stats.unbroken++;
        }
    });

    allHolderStats = Object.values(ownerStats).map(stats => {
            const liquid = stats.total - (stats.daodaoStaked + stats.enterpriseStaked + stats.bblListed + stats.boostListed);
            return { ...stats, liquid };
        });

    sortAndDisplayHolders();
};

const sortAndDisplayHolders = () => {
    const { column, direction } = holderSort;
    allHolderStats.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        if (column === 'address') {
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return direction === 'asc' ? valA - valB : valB - valA;
        }
    });
    displayHolderPage(1);
};

const displayHolderPage = (page) => {
    holderCurrentPage = page;
    leaderboardTable.innerHTML = ''; 

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const headerRow = document.createElement('tr');
    
    const createHeaderCell = (label, columnKey) => {
        const th = document.createElement('th');
        const span = document.createElement('span');

        const isSortCol = holderSort.column === columnKey;
        const ascActive = isSortCol && holderSort.direction === 'asc';
        const descActive = isSortCol && holderSort.direction === 'desc';
        
        if (isSortCol) span.classList.add('sort-active');

        span.dataset.sortBy = columnKey;
        span.innerHTML = `${label}<svg class="sort-icon w-4 h-4 ${ascActive ? 'active' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg><svg class="sort-icon w-4 h-4 ${descActive ? 'active' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
        th.appendChild(span);
        return th;
    };
    
    const headerData = [
        { label: 'Rank' }, { label: 'Holder', key: 'address' },
        { label: 'Liquid', key: 'liquid' }, { label: 'DAODAO', key: 'daodaoStaked' },
        { label: 'Enterprise', key: 'enterpriseStaked' }, { label: 'Broken', key: 'broken' },
        { label: 'Unbroken', key: 'unbroken' }, { label: 'BBL Listed', key: 'bblListed' },
        { label: 'Boost Listed', key: 'boostListed' }, { label: 'Total', key: 'total' }
    ];

    headerData.forEach(h => {
        if (h.key) {
            headerRow.appendChild(createHeaderCell(h.label, h.key));
        } else {
            const th = document.createElement('th');
            th.textContent = h.label;
            headerRow.appendChild(th);
        }
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const pageItems = allHolderStats.slice((page - 1) * holdersPerPage, page * holdersPerPage);

    pageItems.forEach(({ address, ...stats }, index) => {
        const itemRow = document.createElement('tr');
        itemRow.className = 'leaderboard-row-item'; // Renamed to avoid style conflicts
        itemRow.dataset.address = address;

        const rank = (page - 1) * holdersPerPage + index + 1;
        const shortAddress = `terra...${address.substring(address.length - 4)}`;

        const createCell = (value, classes = [], title = '') => {
            const cell = document.createElement('td');
            cell.textContent = value;
            if(classes.length > 0) cell.classList.add(...classes);
            if (title) cell.title = title;
            return cell;
        };

        itemRow.appendChild(createCell(`#${rank}`, ['font-bold']));
        itemRow.appendChild(createCell(shortAddress, ['font-mono', 'text-sm'], address));
        itemRow.appendChild(createCell(stats.liquid));
        itemRow.appendChild(createCell(stats.daodaoStaked, ['text-green-400']));
        itemRow.appendChild(createCell(stats.enterpriseStaked, ['text-red-400']));
        itemRow.appendChild(createCell(stats.broken, ['text-red-400']));
        itemRow.appendChild(createCell(stats.unbroken, ['text-green-400']));
        itemRow.appendChild(createCell(stats.bblListed));
        itemRow.appendChild(createCell(stats.boostListed));
        itemRow.appendChild(createCell(stats.total, ['font-bold']));
        
        itemRow.addEventListener('click', () => {
            walletSearchAddressInput.value = address;
            searchWallet();
        });
        tbody.appendChild(itemRow);
    });
    table.appendChild(tbody);
    leaderboardTable.appendChild(table);

    updateHolderPaginationControls();
};

const updateHolderPaginationControls = () => {
    leaderboardPagination.innerHTML = '';
    const totalPages = Math.ceil(allHolderStats.length / holdersPerPage);
    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.className = 'pagination-btn';
    prevButton.disabled = holderCurrentPage === 1;
    prevButton.onclick = () => displayHolderPage(holderCurrentPage - 1);
    leaderboardPagination.appendChild(prevButton);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'text-gray-400';
    pageInfo.textContent = `Page ${holderCurrentPage} of ${totalPages}`;
    leaderboardPagination.appendChild(pageInfo);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.className = 'pagination-btn';
    nextButton.disabled = holderCurrentPage === totalPages;
    nextButton.onclick = () => displayHolderPage(holderCurrentPage + 1);
    leaderboardPagination.appendChild(nextButton);
};

// --- Map View Logic ---
//let isMapInitialized = false; // Moved initialization check inside initializeStarfield
const initializeStarfield = () => {
    // Check if already initialized or canvas not found
    const canvas = document.getElementById('space-canvas');
    if (!canvas) {
        console.error("Space canvas element not found!");
        return;
    }
     // If map is already running, don't re-initialize
    if (isMapInitialized) {
        // Ensure animation is running if we switch back to the tab
        if (!globalAnimationFrameId) {
             console.log("Restarting map animation frame."); // Debug log
             animate(); // Restart animation loop if stopped
        }
        return;
    }
    console.log("Initializing starfield..."); // Debug log

    const ctx = canvas.getContext('2d');
    let stars = [];
    let mapObjects = [];
    
    let zoom = 0.15, rotation = 0, offsetX = 0, offsetY = 0;
    let isPanning = false, isRotating = false;
    let lastMouseX = 0, lastMouseY = 0;
    const minZoom = 0.1, maxZoom = 5;

    function setCanvasSize() {
        // Ensure canvas dimensions reflect actual display size
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        // Check if the canvas size needs updating
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
             console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`); // Debug log
            return true; // Indicate size changed
        }
        return false; // Indicate size did not change
    }
    
    // ... existing createStars function ...
    function createStars() {
        stars = [];
        // Ensure width/height are valid before calculating count
        const width = canvas.width || canvas.clientWidth;
        const height = canvas.height || canvas.clientHeight;
        if (width === 0 || height === 0) return; // Don't create stars if canvas size is invalid

        const starCount = (width * height * 4) / 1000; 
        console.log(`Creating ${Math.round(starCount)} stars for ${width}x${height} canvas.`); // Debug log
        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: (Math.random() - 0.5) * width * 10, // Use calculated width/height
                y: (Math.random() - 0.5) * height * 10, // Use calculated width/height
                radius: Math.random() * 1.5 + 0.5,
                alpha: Math.random(),
                twinkleSpeed: Math.random() * 0.03 + 0.005,
                twinkleDirection: 1
            });
        }
    }


    // ... existing drawGalaxy, updateStars, updateObjectRotations functions ...
    function drawGalaxy() {
        if (!ctx) return; // Ensure context is valid
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Check for valid dimensions before proceeding
        if (canvas.width === 0 || canvas.height === 0) {
             ctx.restore();
             console.warn("Skipping drawGalaxy: Canvas dimensions are zero."); // Debug log
             return;
        }
        ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
        ctx.scale(zoom, zoom);
        ctx.rotate(rotation);

        stars.forEach(star => {
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
            ctx.fill();
        });
        
        const systemLineColors = {
            daodao: 'rgba(56, 189, 248, 0.7)', // Blue
            bbl: 'rgba(16, 185, 129, 0.7)', // Green
            boost: 'rgba(168, 85, 247, 0.7)', // Purple
            enterprise: 'rgba(56, 189, 248, 0.7)' // Blue
        };

        mapObjects.forEach(obj => {
            if (obj.lineTargetId) {
                const target = mapObjects.find(t => t.id === obj.lineTargetId);
                if (target) {
                    ctx.beginPath();
                    ctx.moveTo(obj.x, obj.y);
                    if (obj.lineTargetId === 'enterprise') {
                        const angle = Math.atan2(obj.y - target.y, obj.x - target.x);
                        // Ensure target width/scale are valid numbers
                        const targetWidth = (typeof target.width === 'number' && target.width > 0) ? target.width : 100; // Default width
                        const targetScale = (typeof target.scale === 'number' && target.scale > 0) ? target.scale : 0.1; // Default scale
                        const edgeRadius = (targetWidth * targetScale / 2) * 0.45; 
                        ctx.lineTo(target.x + Math.cos(angle) * edgeRadius, target.y + Math.sin(angle) * edgeRadius);
                    } else if (obj.id.startsWith('satellite')) {
                        ctx.lineTo(target.x, target.y);
                        const mothership = mapObjects.find(m => m.id === `mothership_${obj.system}_${obj.address}`);
                        if(mothership) ctx.lineTo(mothership.x, mothership.y);
                    }
                    ctx.strokeStyle = systemLineColors[obj.system];
                    ctx.lineWidth = 2 / zoom;
                    ctx.stroke();
                }
            }
        });

        mapObjects.forEach(obj => {
            // Check if image is loaded and dimensions are valid
            if (!obj.img || !obj.img.complete || !(obj.width > 0) || !(obj.height > 0)) return;
            
            let displayWidth = obj.width * obj.scale;
            let displayHeight = obj.height * obj.scale;
            
            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.rotate(obj.rotation || 0);
            try {
                ctx.drawImage(obj.img, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight);
            } catch (e) {
                console.error("Error drawing image for object:", obj.id, e);
            }
            ctx.restore();

            if(obj.textAbove || obj.textBelow) {
                ctx.save();
                ctx.translate(obj.x, obj.y);
                ctx.rotate(-rotation);
                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                const textScale = 1 / zoom;
                if (obj.textAbove) {
                    ctx.font = `bold ${18 * textScale}px Inter`;
                    ctx.fillText(obj.textAbove, 0, -displayHeight / 2 - (10 * textScale));
                }
                if (obj.textBelow) {
                     ctx.font = `${16 * textScale}px Inter`;
                     ctx.fillStyle = '#9ca3af';
                     ctx.fillText(obj.textBelow, 0, displayHeight / 2 + (20 * textScale));
                }
                ctx.restore();
            }
        });

        ctx.restore();
    }
     function updateStars() {
        stars.forEach(star => {
            star.alpha += star.twinkleSpeed * star.twinkleDirection;
            if (star.alpha > 1 || star.alpha < 0) {
                 star.alpha = Math.max(0, Math.min(1, star.alpha)); // Clamp alpha
                 star.twinkleDirection *= -1;
            }
        });
    }
    
    function updateObjectRotations() {
        mapObjects.forEach(obj => {
            if (obj.rotationSpeed && !obj.isFrozen) {
                obj.rotation = (obj.rotation || 0) + obj.rotationSpeed; // Ensure rotation is initialized
            }
        });
    }

    function animate() {
        // Stop animation if canvas is no longer in the DOM or map view is hidden
        if (!document.body.contains(canvas) || mapView.classList.contains('hidden')) {
            console.log("Map view hidden or canvas removed, stopping animation."); // Debug log
             if (globalAnimationFrameId) {
                cancelAnimationFrame(globalAnimationFrameId);
                globalAnimationFrameId = null;
            }
            isMapInitialized = false; // Allow re-initialization next time
            return;
        }
        updateStars();
        updateObjectRotations();
        drawGalaxy();
        globalAnimationFrameId = requestAnimationFrame(animate); // Continue animation
    }
    
    // ... existing addMapObject function ...
     function addMapObject(config, preloadedImages) {
        const img = preloadedImages[config.imageId];
        if (!img) {
            console.error(`Image with ID ${config.imageId} not preloaded.`);
            return;
        }
        // Ensure image has dimensions before adding
        if (!img.width || !img.height) {
             console.warn(`Image ${config.imageId} has zero dimensions, attempting reload or skip.`);
             // Optional: try reloading image here if needed
             return; 
        }
        mapObjects.push({ 
             ...config, 
             img: img, 
             width: img.width, 
             height: img.height, 
             isFrozen: false,
             rotation: config.rotation || 0 // Ensure rotation is initialized
        });
    }


    function init() {
        console.log("Running init function..."); // Debug log
        if (globalAnimationFrameId) { 
            cancelAnimationFrame(globalAnimationFrameId); 
            globalAnimationFrameId = null;
        }

        setCanvasSize(); // Attempt to set size based on client dimensions
        // **CRITICAL CHECK:** Ensure canvas has valid dimensions AFTER setting them.
        if (canvas.width === 0 || canvas.height === 0) {
            console.error("Canvas dimensions are zero immediately after setCanvasSize. Map initialization aborted.");
            // Optionally try again slightly later, although requestAnimationFrame should handle this.
             // setTimeout(init, 50); 
            return; // Stop initialization
        }
       
        mapObjects = []; 
        createStars(); // Create stars based on current (hopefully valid) dimensions
        
        const imageAssets = {
            daodao: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/daodao-planet.png',
            bbl: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/bbl-planet.png',
            boost: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/boost-ship.png',
            enterprise: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/enterprise-blackhole.png',
            allianceLogo: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/aDAO%20Logo%20No%20Background.png',
            terra: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/Terra.PNG'
        };

        const imagePromises = Object.entries(imageAssets).map(([id, url]) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    // Double check dimensions on load
                     if (img.width === 0 || img.height === 0) {
                        console.warn(`Image loaded but has zero dimensions: ${id}`);
                    }
                    resolve({ id, img });
                };
                img.onerror = (err) => {
                     console.error(`Failed to load image: ${id} from ${url}`, err); // Log error with URL
                     // Resolve with a placeholder or skip? For now, reject.
                     reject(new Error(`Failed to load ${id}`));
                };
                img.src = url;
            });
        });

        Promise.all(imagePromises).then(loadedImageArray => {
            const preloadedImages = loadedImageArray.reduce((acc, {id, img}) => {
                acc[id] = img;
                return acc;
            }, {});
            
            // Re-check canvas size *after* images load, before building systems that rely on positions
            setCanvasSize();
             if (canvas.width === 0 || canvas.height === 0) {
                 console.error("Canvas dimensions became zero after image load. Map initialization aborted.");
                 return; 
             }

            buildGalaxySystems(preloadedImages);
            isMapInitialized = true; // Set flag only after successful setup
            console.log("Starfield initialization complete. Starting animation."); // Debug log
            animate(); // Start animation loop

        }).catch(error => {
             console.error("Error loading one or more system images:", error);
             showError(canvas.parentElement, `Could not load map assets. Error: ${error.message}`); // Show error in UI
             isMapInitialized = false; // Ensure flag remains false on error
        });
    }
    
    // ... existing buildGalaxySystems function ...
    function buildGalaxySystems(preloadedImages) {
        // Ensure width/height are valid before calculating positions
        const width = canvas.width || canvas.clientWidth;
        const height = canvas.height || canvas.clientHeight;
        if (width === 0 || height === 0) {
            console.error("Cannot build galaxy systems, canvas dimensions are zero.");
            return;
        }

        const systemCenters = {
            daodao: { x: 0, y: -height * 2 }, // Use calculated height
            bbl: { x: -width * 2, y: 0 },   // Use calculated width
            boost: { x: width * 2, y: 0 },  // Use calculated width
            enterprise: { x: 0, y: height * 2 } // Use calculated height
        };

        addMapObject({
            id: 'terra', imageId: 'terra', type: 'planet',
            x: 0, y: 0, scale: 0.25, rotation: 0
        }, preloadedImages);

        const addSystemCenter = (id, imageId, type, scale, spin) => {
            addMapObject({
                id: id, imageId: imageId, type: type,
                x: systemCenters[id].x, y: systemCenters[id].y,
                scale: scale, rotation: 0, rotationSpeed: spin ? (Math.random() - 0.5) * 0.002 : 0
            }, preloadedImages);
        };
        // Safely calculate scales based on counts (avoid division by zero)
        const bblCount = allNfts.filter(n=>n.bbl_market).length;
        const boostCount = allNfts.filter(n=>n.boost_market).length;
        const enterpriseCount = allNfts.filter(n=>n.staked_enterprise_legacy).length;

        addSystemCenter('daodao', 'daodao', 'planet', 0.5, true);
        addSystemCenter('bbl', 'bbl', 'planet', bblCount > 0 ? (bblCount / 59) * 0.5 : 0.1, true); // Min scale if 0
        addSystemCenter('boost', 'boost', 'ship_main', boostCount > 0 ? (boostCount / 59) * 0.5 : 0.1, true); // Min scale if 0
        addSystemCenter('enterprise', 'enterprise', 'blackhole', enterpriseCount > 0 ? (enterpriseCount / 515) * 0.5 : 0.1, true); // Min scale if 0


        const holderStats = {};
        allNfts.forEach(nft => {
            if (nft.owner) {
                if (!holderStats[nft.owner]) {
                    holderStats[nft.owner] = { total: 0, daodaoStaked: 0, bblListed: 0, boostListed: 0, enterpriseStaked: 0 };
                }
                const stats = holderStats[nft.owner];
                stats.total++;
                if (nft.staked_daodao) stats.daodaoStaked++;
                if (nft.bbl_market) stats.bblListed++;
                if (nft.boost_market) stats.boostListed++;
                if (nft.staked_enterprise_legacy) stats.enterpriseStaked++;
            }
        });

        const createFleetSystem = (systemId, statKey) => {
            const center = systemCenters[systemId];
            
             const topHolders = Object.entries(holderStats)
                .filter(([, stats]) => stats[statKey] > 0)
                .sort(([, a], [, b]) => b[statKey] - a[statKey])
                .slice(0, 10)
                .map(([address, stats]) => ({ address, ...stats }));
            
            if (topHolders.length === 0) return;

            const countList = topHolders.map(s => s[statKey]);
            const minCount = countList.length > 0 ? Math.min(...countList) : 1;
            const maxCount = countList.length > 0 ? Math.max(...countList) : 1;
            const countRange = maxCount > minCount ? maxCount - minCount : 1;

            const minScale = 0.1; const maxScale = 0.3;
            const scaleRange = maxScale - minScale;
            
            // Use current canvas dimensions for radius calculations
            const currentWidth = canvas.width || canvas.clientWidth;
            const currentHeight = canvas.height || canvas.clientHeight;
            const minRadius = Math.min(currentWidth, currentHeight) * 0.6;
            const maxRadius = Math.min(currentWidth, currentHeight) * 1.5;
            const radiusRange = maxRadius - minRadius;
            const angleStep = (2 * Math.PI) / topHolders.length;

            topHolders.forEach((stats, index) => {
                const { address, total } = stats;
                const platformCount = stats[statKey];
                const angle = angleStep * index;
                
                // Avoid division by zero if countRange is 1 and platformCount equals minCount
                const normalizedSize = countRange === 1 ? 0 : (platformCount - minCount) / countRange;
                const distance = minRadius + (normalizedSize * radiusRange);
                const scale = minScale + (normalizedSize * scaleRange);
                const last4 = address.slice(-4);
                
                const mothershipX = center.x + Math.cos(angle) * distance;
                const mothershipY = center.y + Math.sin(angle) * distance;

                addMapObject({
                    id: `mothership_${systemId}_${address}`, imageId: 'allianceLogo', type: 'ship', address: address,
                    system: systemId, lineTargetId: `satellite_${systemId}_${address}`,
                    x: mothershipX, y: mothershipY, scale: scale,
                    textAbove: `${total - platformCount}`, textBelow: last4
                }, preloadedImages);
                
                addMapObject({
                    id: `satellite_${systemId}_${address}`, imageId: 'allianceLogo', type: 'ship', address: address,
                    system: systemId, lineTargetId: systemId,
                    x: (mothershipX + center.x) / 2, y: (mothershipY + center.y) / 2,
                    scale: scale * 0.8, // Satellite slightly smaller
                    textAbove: `${platformCount}`, textBelow: last4
                }, preloadedImages);
            });
        };
        
        const createEnterpriseSystem = () => {
             // Use current canvas dimensions
             const currentWidth = canvas.width || canvas.clientWidth;
             const currentHeight = canvas.height || canvas.clientHeight;
             if (currentWidth === 0 || currentHeight === 0) return; // Guard clause

             const center = systemCenters.enterprise;
             const statKey = 'enterpriseStaked'; // Define statKey here
            
             const topStakers = Object.entries(holderStats)
                .filter(([, stats]) => stats.enterpriseStaked > 0)
                // Corrected sorting key here
                .sort(([, a], [, b]) => b.enterpriseStaked - a.enterpriseStaked) 
                .slice(0, 10)
                .map(([address, stats]) => ({ address, ...stats }));
            
            if (topStakers.length === 0) return;

            const countList = topStakers.map(s => s.enterpriseStaked);
            const minCount = Math.min(...countList);
            const maxCount = Math.max(...countList);
            const countRange = maxCount > minCount ? maxCount - minCount : 1;

            const minScale = 0.1; const maxScale = 0.3;
            const scaleRange = maxScale - minScale;

            const minRadius = Math.min(currentWidth, currentHeight) * 0.6;
            const maxRadius = Math.min(currentWidth, currentHeight) * 1.2;
            const radiusRange = maxRadius - minRadius;
            const angleStep = (2 * Math.PI) / topStakers.length;
            
            topStakers.forEach((stats, index) => {
                const { address, enterpriseStaked } = stats;
                const angle = angleStep * index;
                
                 // Avoid division by zero
                const normalizedSize = countRange === 1 ? 0 : (enterpriseStaked - minCount) / countRange;
                const distance = minRadius + (normalizedSize * radiusRange);
                const scale = minScale + (normalizedSize * scaleRange);
                
                addMapObject({
                    id: `ship_enterprise_${address}`, imageId: 'allianceLogo', type: 'ship', address: address,
                    system: 'enterprise', lineTargetId: 'enterprise',
                    x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance,
                    scale: scale, textAbove: `${enterpriseStaked}`, textBelow: address.slice(-4)
                }, preloadedImages);
            });
        };

        createFleetSystem('daodao', 'daodaoStaked');
        createFleetSystem('bbl', 'bblListed');
        createFleetSystem('boost', 'boostListed');
        createEnterpriseSystem();
        console.log("Galaxy systems built."); // Debug log
    }

    // --- Event Listeners for Panning and Zooming ---
    // Remove existing listeners before adding new ones to prevent duplicates if init runs multiple times
    const removeIfExists = (element, type, handler, options) => {
         if (element && typeof element.removeEventListener === 'function') {
             element.removeEventListener(type, handler, options);
         }
    };
    
    // Define handlers separately to allow removal
    const handleContextMenu = (e) => e.preventDefault();
    const handleMouseDown = (e) => {
         e.preventDefault();
        if (e.button === 1 || e.ctrlKey || e.metaKey) { // Middle mouse or Ctrl/Cmd + Left Click for rotate
            isRotating = true; 
            isPanning = false; 
            canvas.style.cursor = 'ew-resize'; 
        } 
        else if (e.button === 0) { // Left click for pan
            isPanning = true; 
            isRotating = false; 
            canvas.style.cursor = 'grabbing'; 
        }
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    };
     const handleMouseUp = (e) => {
        e.preventDefault();
        isPanning = false; // Always stop panning on mouse up
        isRotating = false; // Always stop rotating on mouse up
        canvas.style.cursor = 'grab'; // Reset cursor
    };
     const handleMouseLeave = () => {
        isPanning = false;
        isRotating = false;
        canvas.style.cursor = 'grab';
    };
     const handleMouseMove = (e) => {
         // ... (rest of mouse move logic remains the same) ...
         const rect = canvas.getBoundingClientRect();
         // Check if rect dimensions are valid
        if (rect.width === 0 || rect.height === 0) return; 

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Check if mouse coordinates are valid relative to canvas
        if (mouseX < 0 || mouseX > canvas.width || mouseY < 0 || mouseY > canvas.height) {
            // Mouse is outside the canvas bounds, potentially due to rapid movement or leaving window
             if (isPanning || isRotating) { // If dragging, stop the drag operation
                 isPanning = false;
                 isRotating = false;
                 canvas.style.cursor = 'grab';
             }
            return; 
        }


        // Calculate world coordinates relative to the current view transform
         // Add guards for zoom being zero
        const currentZoom = (zoom === 0) ? 0.0001 : zoom; // Prevent division by zero
        const worldX = (mouseX - (canvas.width / 2 + offsetX)) / currentZoom;
        const worldY = (mouseY - (canvas.height / 2 + offsetY)) / currentZoom;

        // Apply inverse rotation to get coordinates in the unrotated world space
        const sinR = Math.sin(-rotation);
        const cosR = Math.cos(-rotation);
        const rotatedX = worldX * cosR - worldY * sinR;
        const rotatedY = worldX * sinR + worldY * cosR;

         if (isPanning || isRotating) {
             if (isPanning) {
                 offsetX += e.clientX - lastMouseX;
                 offsetY += e.clientY - lastMouseY;
             } else if (isRotating) {
                 rotation += (e.clientX - lastMouseX) / 300;
             }
         } else {
             // Hover detection logic
             let isAnyObjectHovered = false;
             // Iterate backwards to check topmost objects first
             for (let i = mapObjects.length - 1; i >= 0; i--) {
                 const obj = mapObjects[i];
                 // Ensure object properties are valid before hit testing
                 if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number' || typeof obj.width !== 'number' || typeof obj.height !== 'number' || typeof obj.scale !== 'number') continue; 

                 const displayWidth = obj.width * obj.scale;
                 const displayHeight = obj.height * obj.scale;
                 const halfWidth = displayWidth / 2;
                 const halfHeight = displayHeight / 2;

                 // Simple AABB (Axis-Aligned Bounding Box) check in the rotated world space
                 const isHovered = (
                     rotatedX >= obj.x - halfWidth && 
                     rotatedX <= obj.x + halfWidth && 
                     rotatedY >= obj.y - halfHeight && 
                     rotatedY <= obj.y + halfHeight
                 );

                 obj.isFrozen = isHovered; // Freeze rotation on hover

                 if (isHovered && (obj.address || ['daodao', 'bbl', 'boost', 'enterprise'].includes(obj.id))) {
                     isAnyObjectHovered = true;
                     break; // Found a hover target, no need to check objects underneath
                 }
             }
             canvas.style.cursor = isAnyObjectHovered ? 'pointer' : 'grab';
         }
         lastMouseX = e.clientX;
         lastMouseY = e.clientY;
    };
     const handleWheel = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // Prevent zoom if canvas has no size

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomFactor = 1.1;

         // Prevent division by zero if zoom is somehow 0
        const currentZoom = (zoom === 0) ? 0.0001 : zoom; 

        // World coordinates before zoom
        const mouseBeforeZoomX = (mouseX - (canvas.width / 2 + offsetX)) / currentZoom;
        const mouseBeforeZoomY = (mouseY - (canvas.height / 2 + offsetY)) / currentZoom;

        let newZoom;
        if (e.deltaY < 0) { // Zoom in
             newZoom = Math.min(maxZoom, currentZoom * zoomFactor); 
        } 
        else { // Zoom out
             newZoom = Math.max(minZoom, currentZoom / zoomFactor); 
        }
         // Prevent zoom from becoming exactly zero
         if (newZoom <= 0) newZoom = minZoom; 

         // World coordinates after zoom
         const mouseAfterZoomX = (mouseX - (canvas.width / 2 + offsetX)) / newZoom;
         const mouseAfterZoomY = (mouseY - (canvas.height / 2 + offsetY)) / newZoom;

         // Adjust offset to keep the point under the mouse stationary
         offsetX += (mouseAfterZoomX - mouseBeforeZoomX) * newZoom;
         offsetY += (mouseAfterZoomY - mouseBeforeZoomY) * newZoom;

         zoom = newZoom; // Update the global zoom state
    };
    const handleClick = (e) => {
         // ... (rest of click logic remains the same) ...
         const rect = canvas.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

         const mouseX = e.clientX - rect.left;
         const mouseY = e.clientY - rect.top;

         // Add guards for zoom being zero
         const currentZoom = (zoom === 0) ? 0.0001 : zoom;
         const worldX = (mouseX - (canvas.width / 2 + offsetX)) / currentZoom;
         const worldY = (mouseY - (canvas.height / 2 + offsetY)) / currentZoom;
         const sinR = Math.sin(-rotation);
         const cosR = Math.cos(-rotation);
         const rotatedX = worldX * cosR - worldY * sinR;
         const rotatedY = worldX * sinR + worldY * cosR;

         let clickedObject = null;
         // Check in reverse to prioritize clicking top-most items
         for (let i = mapObjects.length - 1; i >= 0; i--) {
             const obj = mapObjects[i];
              // Add checks for valid object properties
              if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number' || typeof obj.width !== 'number' || typeof obj.height !== 'number' || typeof obj.scale !== 'number') continue; 

             const displayWidth = obj.width * obj.scale;
             const displayHeight = obj.height * obj.scale;
             const halfWidth = displayWidth / 2;
             const halfHeight = displayHeight / 2;
             
             if (rotatedX >= obj.x - halfWidth && rotatedX <= obj.x + halfWidth && rotatedY >= obj.y - halfHeight && rotatedY <= obj.y + halfHeight) {
                 clickedObject = obj;
                 break; 
             }
         }

         if (clickedObject) {
             console.log("Clicked map object:", clickedObject); // Debug log
             if (clickedObject.address) {
                 showWalletExplorerModal(clickedObject.address);
             } else if (['daodao', 'bbl', 'boost', 'enterprise'].includes(clickedObject.id)) {
                  showSystemLeaderboardModal(clickedObject.id);
             }
         } else {
             console.log("Clicked empty space on map."); // Debug log
         }
    };
    const handleResize = debounce(() => {
        console.log("Window resize detected, re-initializing map."); // Debug log
        isMapInitialized = false; // Reset flag to allow re-init
        initializeStarfield(); // Re-initialize completely on resize
    }, 250);

    // Remove old listeners
    removeIfExists(canvas, 'contextmenu', handleContextMenu);
    removeIfExists(canvas, 'mousedown', handleMouseDown);
    removeIfExists(canvas, 'mouseup', handleMouseUp);
    removeIfExists(canvas, 'mouseleave', handleMouseLeave);
    removeIfExists(canvas, 'mousemove', handleMouseMove);
    removeIfExists(canvas, 'wheel', handleWheel, { passive: false });
    removeIfExists(canvas, 'click', handleClick);
    removeIfExists(window, 'resize', handleResize);


    // Add new listeners
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('mousedown', handleMouseDown);
    // Add listeners to window for mouseup/leave to catch events outside canvas
    window.addEventListener('mouseup', handleMouseUp); 
    // canvas.addEventListener('mouseleave', handleMouseLeave); // Keep mouseleave on canvas
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false }); // Need passive: false to prevent default scroll zoom
    canvas.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);

    init(); // Start the initialization process
};


// ... rest of existing code ...


// --- Reusable Address Search Handler ---
const debouncedFilter = debounce(handleFilterChange, 300); // Define debouncedFilter globally for address handler

const handleAddressInput = (inputEl, suggestionsEl, onSelectCallback, isWallet) => {
    const input = inputEl.value.toLowerCase();
    const reversedInput = input.split('').reverse().join('');
    suggestionsEl.innerHTML = '';

    if (!input) {
        suggestionsEl.classList.add('hidden');
        if (!isWallet) debouncedFilter(); // Call global debouncedFilter
        return;
    }

    let matches = ownerAddresses.filter(addr => addr.toLowerCase().endsWith(reversedInput));

    const sortIndex = reversedInput.length;
    matches.sort((a, b) => {
        const charA = a.charAt(a.length - 1 - sortIndex) || '';
        const charB = b.charAt(b.length - 1 - sortIndex) || '';
        return charA.localeCompare(charB);
    });

    // Don't auto-select if exact match to prevent overwriting user input
    // if (matches.length === 1 && inputEl.value !== matches[0]) {
    //     inputEl.value = matches[0];
    //     suggestionsEl.classList.add('hidden');
    //     onSelectCallback();
    //     return;
    // }

    if (matches.length > 0) {
        matches.slice(0, 10).forEach(match => {
            const item = document.createElement('div');
            item.className = 'address-suggestion-item';
            const startIndex = match.length - reversedInput.length;
            // Highlight only the matching part at the end
            item.innerHTML = `${match.substring(0, startIndex)}<strong class="text-cyan-400">${match.substring(startIndex)}</strong>`;
            item.style.direction = 'ltr'; // Ensure LTR for address display
            item.style.textAlign = 'left';
            item.onclick = () => {
                inputEl.value = match; // Set the full address on click
                 // Manually reverse for input display if needed (but keep actual value LTR)
                 // inputEl.value = match.split('').reverse().join(''); // If input needs to remain reversed visually
                suggestionsEl.classList.add('hidden');
                onSelectCallback(); // Trigger the search/filter
            };
            suggestionsEl.appendChild(item);
        });
        if (matches.length > 10) {
            const item = document.createElement('div');
            item.className = 'address-suggestion-item text-gray-400';
            item.textContent = `${matches.length - 10} more... Keep typing`;
            suggestionsEl.appendChild(item);
        }
        suggestionsEl.classList.remove('hidden');
    } else {
        suggestionsEl.classList.add('hidden');
    }
    
    // Trigger filter update on input for collection view
    if (!isWallet) {
        debouncedFilter(); // Call global debouncedFilter
    }
};


// ... rest of existing code ...


// --- Initialize Application ---
initializeExplorer();

