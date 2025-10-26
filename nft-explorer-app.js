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
        let mergedNft = { ...nft }; // Start with metadata

        if (status) {
            // Add status properties
            mergedNft.owner = status.owner;
            mergedNft.broken = status.broken;
            mergedNft.staked_daodao = status.daodao;
            mergedNft.staked_enterprise_legacy = status.enterprise;
            mergedNft.bbl_market = status.bbl;
            mergedNft.boost_market = status.boost;
            // IMPORTANT: Recalculate 'liquid' based on user's definition
            const isStaked = status.daodao || status.enterprise;
            const isListed = status.bbl || status.boost;
            // Assume 'owned_by_alliance_dao' exists in statusData based on user example
            const isOwnedByDAO = status.owner === DAO_WALLET_ADDRESS; // Use direct address check instead of potentially missing flag

            mergedNft.liquid = !isOwnedByDAO && !isStaked && !isListed;

            // Include owned_by_alliance_dao if needed elsewhere, calculated from owner
            mergedNft.owned_by_alliance_dao = isOwnedByDAO;

        } else {
             // If no status data, assume it's liquid unless it's known to be owned by DAO (though unlikely scenario without status)
             mergedNft.owner = null; // Or some default
             mergedNft.broken = false;
             mergedNft.staked_daodao = false;
             mergedNft.staked_enterprise_legacy = false;
             mergedNft.bbl_market = false;
             mergedNft.boost_market = false;
             mergedNft.liquid = true; // Default assumption if no status
             mergedNft.owned_by_alliance_dao = false;
        }
        return mergedNft;
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
    if (addressSearchTerm) {
        // Filter by exact match or partial match from the end if input is shorter
        tempNfts = tempNfts.filter(nft =>
            nft.owner &&
            (nft.owner.toLowerCase() === addressSearchTerm ||
             (addressSearchTerm.length < 42 && nft.owner.toLowerCase().endsWith(addressSearchTerm)))
        );
    }
    
    // --- Status Filters ---
    // ... (staked, listed, rewards filters remain the same) ...
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
        else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.broken !== undefined); // Match both broken and unbroken
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.broken === false);
    }

    // Updated Liquid Status Filter logic
    if (document.querySelector('.status-toggle-cb[data-key="liquid_status"]').checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="liquid_status"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.liquid === true); // Slider Left = Liquid
        else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.liquid !== undefined); // Slider Middle = Both (Show all)
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.liquid === false); // Slider Right = Not Liquid
    }
     if (document.querySelector('.status-toggle-cb[data-key="mint_status"]').checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="mint_status"]').value;
        // Check owner against DAO_WALLET_ADDRESS directly
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.owner === DAO_WALLET_ADDRESS); // Un-Minted (Owned by DAO)
        else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.owner !== undefined); // Both (Show all with an owner)
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.owner !== DAO_WALLET_ADDRESS); // Minted (Not owned by DAO)
    }

    // ... (planet, inhabitant, trait, sort filters remain the same) ...
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
    updateFilterCounts(); // Ensure this runs after filtering
    displayPage(1);
};


const updateFilterCounts = () => {
const updateFilterCounts = () => {
    // ... (existing trait, inhabitant, planet counts logic) ...
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
        let totalCount = filteredNfts.length; // Use current filtered set size

        if (key === 'staked') {
             const enterpriseCount = filteredNfts.filter(n => n.staked_enterprise_legacy).length;
             const daodaoCount = filteredNfts.filter(n => n.staked_daodao).length;
             if(slider.value === '0') count = enterpriseCount;
             else if (slider.value === '1') count = filteredNfts.filter(n => n.staked_enterprise_legacy || n.staked_daodao).length; // Count unique NFTs that are staked in either
             else if (slider.value === '2') count = daodaoCount;
        } else if (key === 'listed') {
            const boostCount = filteredNfts.filter(n => n.boost_market).length;
            const bblCount = filteredNfts.filter(n => n.bbl_market).length;
            if(slider.value === '0') count = boostCount;
            else if (slider.value === '1') count = filteredNfts.filter(n => n.boost_market || n.bbl_market).length; // Count unique NFTs listed in either
            else if (slider.value === '2') count = bblCount;
        } else if (key === 'rewards') {
             const brokenCount = filteredNfts.filter(n => n.broken === true).length;
             const unbrokenCount = filteredNfts.filter(n => n.broken === false).length;
             if(slider.value === '0') count = brokenCount;
             else if (slider.value === '1') count = brokenCount + unbrokenCount; // Total count of NFTs with known broken status
             else if (slider.value === '2') count = unbrokenCount;
        } else if (key === 'liquid_status') {
            // Use the recalculated 'liquid' property
            const liquidCount = filteredNfts.filter(n => n.liquid === true).length;
            const notLiquidCount = filteredNfts.filter(n => n.liquid === false).length;
            if(slider.value === '0') count = liquidCount; // Liquid
            else if (slider.value === '1') count = liquidCount + notLiquidCount; // Both (Total NFTs with determined liquid status)
            else if (slider.value === '2') count = notLiquidCount; // Not Liquid
        } else if (key === 'mint_status') {
             // Use owner check directly
            const unmintedCount = filteredNfts.filter(n => n.owner === DAO_WALLET_ADDRESS).length;
            const mintedCount = filteredNfts.filter(n => n.owner !== DAO_WALLET_ADDRESS).length;
            if(slider.value === '0') count = unmintedCount; // Un-Minted
            else if (slider.value === '1') count = unmintedCount + mintedCount; // Both (Total NFTs with an owner)
            else if (slider.value === '2') count = mintedCount; // Minted
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
    
    // Updated Status Display Logic
    const isStaked = nft.staked_daodao || nft.staked_enterprise_legacy;
    const isListed = nft.bbl_market || nft.boost_market;
    let statusText = 'Unknown';
    if (nft.owner === DAO_WALLET_ADDRESS) {
        statusText = 'Un-Minted (DAO Owned)';
    } else if (nft.liquid) { // Use recalculated liquid status
        statusText = 'Liquid (In Wallet)';
    } else if (isStaked) {
        statusText = 'Staked'; // Could specify DAODAO/Enterprise if needed
    } else if (isListed) {
        statusText = 'Listed'; // Could specify BBL/Boost if needed
    } else {
        // If not liquid, not staked, not listed, and not DAO owned, it's likely still just 'In Wallet' but considered non-liquid by some definition
        // We'll stick to 'Liquid' based on our calculation or specific status
         statusText = 'In Wallet (Not Liquid)'; // Fallback if somehow `nft.liquid` is false but no other status applies
    }

    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Status:</span><span class="font-semibold text-white">${statusText}</span></div>`;
    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Listed:</span><span class="font-semibold text-white">${isListed ? 'Yes' : 'No'}</span></div>`;
    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Broken:</span><span class="font-semibold text-white">${nft.broken ? 'Yes' : 'No'}</span></div>`;
    traitsHtml += `<div class="pt-2 mt-2 border-t border-gray-600"></div>`;
    traitsHtml += `<div class="flex justify-between text-sm items-center"><span class="text-gray-400">Owner:</span><span class="owner-address font-mono text-sm font-semibold text-white truncate cursor-pointer" title="Click to copy">${nft.owner || 'N/A'}</span></div>`;

    const modalTraits = document.getElementById('modal-traits');
    modalTraits.innerHTML = traitsHtml;
    // Add click listener only if owner exists
    const ownerAddressEl = modalTraits.querySelector('.owner-address');
    if (nft.owner && ownerAddressEl) {
         ownerAddressEl.addEventListener('click', () => copyToClipboard(nft.owner, 'Owner Address'));
    } else if (ownerAddressEl) {
         ownerAddressEl.classList.remove('cursor-pointer'); // Remove pointer if no owner
         ownerAddressEl.removeAttribute('title');
    }


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
                 // Initialize with recalculated liquid count
                 ownerStats[nft.owner] = { address: nft.owner, total: 0, liquid: 0, daodaoStaked: 0, enterpriseStaked: 0, broken: 0, unbroken: 0, bblListed: 0, boostListed: 0 };
            }
            const stats = ownerStats[nft.owner];
            stats.total++;
            // Increment liquid count based on the recalculated property
            if (nft.liquid) stats.liquid++;
            if (nft.staked_daodao) stats.daodaoStaked++;
            if (nft.staked_enterprise_legacy) stats.enterpriseStaked++;
            if (nft.bbl_market) stats.bblListed++;
            if (nft.boost_market) stats.boostListed++;
            if (nft.broken) stats.broken++;
            else stats.unbroken++;
        }
    });

    // No need to map again, liquid is now calculated correctly during aggregation
    allHolderStats = Object.values(ownerStats);

    sortAndDisplayHolders();
};

// ... (displayHolderPage remains largely the same, but will now use the correct liquid count) ...
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
        { label: 'Liquid', key: 'liquid' }, { label: 'DAODAO', key: 'daodaoStaked' }, // Ensure key matches stats object
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
        // Use the calculated liquid count directly from stats
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

const showWalletExplorerModal = (address) => {
    const walletNfts = allNfts.filter(nft => nft.owner === address);
    if (walletNfts.length === 0) return;

    const titleEl = document.getElementById('wallet-modal-title');
    const statsEl = document.getElementById('wallet-modal-stats');
    const galleryEl = document.getElementById('wallet-modal-gallery');

    titleEl.textContent = address;
    statsEl.innerHTML = '';
    galleryEl.innerHTML = '';

    // Calculate stats based on the wallet's NFTs, using recalculated liquid status
    const daodaoStaked = walletNfts.filter(n => n.staked_daodao).length;
    const enterpriseStaked = walletNfts.filter(n => n.staked_enterprise_legacy).length;
    const boostListed = walletNfts.filter(n => n.boost_market).length;
    const bblListed = walletNfts.filter(n => n.bbl_market).length;
    const broken = walletNfts.filter(n => n.broken).length;
    const total = walletNfts.length;
    const unbroken = total - broken;
    // Calculate liquid specifically for this wallet using the updated definition
    const liquid = walletNfts.filter(n => n.liquid).length;

    const stats = [
        { label: 'Total NFTs', value: total, color: 'text-white' },
        { label: 'Liquid', value: liquid, color: 'text-white' }, // Display recalculated liquid
        { label: 'DAODAO Staked', value: daodaoStaked, color: 'text-cyan-400' },
        { label: 'Enterprise Staked', value: enterpriseStaked, color: 'text-gray-400' },
        { label: 'Boost Listed', value: boostListed, color: 'text-purple-400' },
        { label: 'BBL Listed', value: bblListed, color: 'text-green-400' },
        { label: 'Unbroken', value: unbroken, color: 'text-green-400' },
        { label: 'Broken', value: broken, color: 'text-red-400' },
    ];

    stats.forEach(stat => {
        statsEl.innerHTML += `
            <div class="text-center">
                <div class="text-xs text-gray-400 uppercase tracking-wider">${stat.label}</div>
                <div class="text-2xl font-bold ${stat.color}">${stat.value}</div>
            </div>
        `;
    });

    walletNfts.sort((a,b) => a.rank - b.rank).forEach(nft => {
        galleryEl.appendChild(createNftCard(nft, '.wallet-trait-toggle'));
    });

    walletExplorerModal.classList.remove('hidden');
};

// ... rest of existing code ...

