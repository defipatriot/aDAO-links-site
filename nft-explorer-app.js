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
const spaceCanvas = document.getElementById('space-canvas'); // Added spaceCanvas
// Add references for new toggles
const togInhabBtn = document.getElementById('toggle-inhabitant-filters');
const inhabArrow = document.getElementById('inhabitant-arrow');
const togPlanBtn = document.getElementById('toggle-planet-filters');
const planArrow = document.getElementById('planet-arrow');


// --- Config ---
const METADATA_URL = "https://cdn.jsdelivr.net/gh/defipatriot/nft-metadata/all_nfts_metadata.json";
const STATUS_DATA_URL = "https://deving.zone/en/nfts/alliance_daos.json";
const DAO_WALLET_ADDRESS = "terra1sffd4efk2jpdt894r04qwmtjqrrjfc52tmj6vkzjxqhd8qqu2drs3m5vzm";
const DAO_LOCKED_WALLET_SUFFIXES = ["8ywv", "417v", "6ugw"]; // Added from previous logic
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
// Map State (moved from inside function to global)
let globalAnimationFrameId;
let isMapInitialized = false;
let mapZoom = 0.15, mapRotation = 0, mapOffsetX = 0, mapOffsetY = 0;
let isPanning = false, isRotating = false;
let lastMouseX = 0, lastMouseY = 0;
let mapStars = [];
let mapObjects = [];
let isInitialLoad = true;


// --- Utility Functions ---
const debounce = (func, delay) => { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; };
const showLoading = (container, message) => { if(container) container.innerHTML = `<p class="text-center col-span-full text-cyan-400 text-lg">${message}</p>`; };
const showError = (container, message) => { if(container) container.innerHTML = `<div class="text-center col-span-full bg-red-900/50 border border-red-700 text-white p-6 rounded-lg"><h3 class="font-bold text-xl">Error</h3><p class="mt-2 text-red-300">${message}</p></div>`; };
function convertIpfsUrl(ipfsUrl) { if (!ipfsUrl || !ipfsUrl.startsWith('ipfs://')) return ''; return `https://ipfs.io/ipfs/${ipfsUrl.replace('ipfs://', '')}`; }

// --- Data Fetching and Processing ---
const mergeNftData = (metadata, statusData) => {
    const statusMap = new Map(statusData.nfts.map(nft => [String(nft.id), nft]));
    return metadata.map(nft => {
        const status = statusMap.get(String(nft.id));
        let mergedNft = { ...nft }; // Start with metadata

        if (status) {
            // Merge status data
            mergedNft.owner = status.owner;
            mergedNft.broken = status.broken;
            mergedNft.staked_daodao = status.daodao;
            mergedNft.staked_enterprise_legacy = status.enterprise;
            mergedNft.bbl_market = status.bbl;
            mergedNft.boost_market = status.boost;

            // Re-calculate liquid status based on all fields
            const isStaked = status.daodao || status.enterprise;
            const isListed = status.bbl || status.boost;
            const isOwnedByMainDAO = status.owner === DAO_WALLET_ADDRESS;
            const isOwnedByLockedDAO = status.owner ? DAO_LOCKED_WALLET_SUFFIXES.some(suffix => status.owner.endsWith(suffix)) : false;
            
            mergedNft.liquid = !isOwnedByMainDAO && !isOwnedByLockedDAO && !isStaked && !isListed;
            mergedNft.owned_by_alliance_dao = isOwnedByMainDAO || isOwnedByLockedDAO; // Keep this if needed
        } else {
            // Set defaults if no status data is found
             mergedNft.owner = null;
             mergedNft.broken = false;
             mergedNft.staked_daodao = false;
             mergedNft.staked_enterprise_legacy = false;
             mergedNft.bbl_market = false;
             mergedNft.boost_market = false;
             mergedNft.liquid = true; // Default to liquid if not in status file?
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
        ownerAddresses = [...new Set(allNfts.map(nft => nft.owner).filter(Boolean))]; // Populate master list

        calculateRanks();
        populateTraitFilters();
        populateInhabitantFilters();
        populatePlanetFilters();
        populateStatusFilters();
        populateTraitToggles();
        populateWalletTraitToggles();
        updateAddressDropdown(allNfts);
        updateFilterCounts(allNfts);
        addAllEventListeners();
        applyStateFromUrl();
        applyFiltersAndSort();
        calculateAndDisplayLeaderboard();
        
        handleHashChange(); // Check hash on initial load
        isInitialLoad = false; // Mark initial load complete

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
                // Rarity score based on all traits except Weather and Light
                if (traitCounts[attr.trait_type]?.[attr.value] && !['Weather', 'Light', 'Rarity'].includes(attr.trait_type)) {
                    const count = traitCounts[attr.trait_type][attr.value];
                    const rarity = count / allNfts.length;
                    if (rarity > 0) totalScore += 1 / rarity;
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
                if (checkbox) { // Ensure checkbox exists
                    label.addEventListener('mouseenter', (e) => showPreviewTile(e, 'Object', checkbox.value));
                    label.addEventListener('mouseleave', hidePreviewTile);
                }
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
            values.sort((a, b) => (traitCounts[traitType]?.[a] || 0) - (traitCounts[traitType]?.[b] || 0));
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
        { key: 'staked', label: 'Staked', left: 'Ent', right: 'DAO' }, // Changed from Enterprise/DAODAO
        { key: 'listed', label: 'Listed', left: 'Boost', right: 'BBL' }, // Changed from Boost/BackBoneLabs
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
    
    // *** ADDED LIQUID FILTER ***
    const liquidStatusFilter = createFilterItem({
        toggleClass: 'status-toggle-cb', key: 'liquid_status', label: 'Liquid Status',
        countClass: 'status-count',
        sliderClass: 'status-slider', left: 'Liquid', right: 'Not Liq'
    });
    // Add it to the same grid as the mint status
    const grid = mintStatusContainer.closest('.grid') || mintStatusContainer.parentElement;
    if (grid) {
        grid.appendChild(liquidStatusFilter);
    }
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
     document.querySelectorAll('.toggle-checkbox').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const parent = e.target.closest('.justify-between');
            if (!parent) return;
            const slider = parent.querySelector('.direction-slider');
            if (slider) {
                slider.disabled = !e.target.checked;
            }
            handleFilterChange();
        });
    });
    document.querySelectorAll('.direction-slider').forEach(slider => slider.addEventListener('input', handleFilterChange));
    document.querySelectorAll('.trait-toggle').forEach(el => el.addEventListener('change', () => displayPage(currentPage)));
    // Note: multi-select-checkbox listeners are added in populateTraitFilters
    
    if (addressDropdown) {
        addressDropdown.addEventListener('change', () => {
            searchAddressInput.value = addressDropdown.value;
            handleFilterChange();
        });
    }
    
    if (walletTraitTogglesContainer) {
        walletTraitTogglesContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('wallet-trait-toggle')) {
                searchWallet(); // Re-render gallery with new toggle settings
            }
        });
    }
    
    // *** ADDED EVENT LISTENERS FOR COLLAPSIBLE SECTIONS ***
    if(togInhabBtn && inhabitantFiltersContainer && inhabArrow) {
        togInhabBtn.addEventListener('click', () => {
            inhabitantFiltersContainer.classList.toggle('hidden');
            inhabArrow.classList.toggle('rotate-180');
        });
    }
    if(togPlanBtn && planetFiltersContainer && planArrow) {
        togPlanBtn.addEventListener('click', () => {
            planetFiltersContainer.classList.toggle('hidden');
            planArrow.classList.toggle('rotate-180');
        });
    }
    
    // Add other listeners from the single file
    document.addEventListener('click', () => closeAllDropdowns());
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideNftDetails);
    if (nftModal) nftModal.addEventListener('click', (e) => { if (e.target === nftModal) hideNftDetails(); });
    if (rarityExplainedBtn) rarityExplainedBtn.addEventListener('click', () => rarityModal.classList.remove('hidden'));
    if (rarityModalCloseBtn) rarityModalCloseBtn.addEventListener('click', () => rarityModal.classList.add('hidden'));
    if (rarityModal) rarityModal.addEventListener('click', (e) => { if (e.target === rarityModal) rarityModal.classList.add('hidden'); });
    if (badgesExplainedBtn) badgesExplainedBtn.addEventListener('click', () => badgeModal.classList.remove('hidden'));
    if (badgeModalCloseBtn) badgeModalCloseBtn.addEventListener('click', () => badgeModal.classList.add('hidden'));
    if (badgeModal) badgeModal.addEventListener('click', (e) => { if (e.target === badgeModal) badgeModal.classList.add('hidden'); });
    if (walletModalCloseBtn) walletModalCloseBtn.addEventListener('click', hideWalletExplorerModal);
    if (walletExplorerModal) walletExplorerModal.addEventListener('click', (e) => { if (e.target === walletExplorerModal) hideWalletExplorerModal(); });
    if (systemModalCloseBtn) systemModalCloseBtn.addEventListener('click', hideSystemLeaderboardModal);
    if (systemLeaderboardModal) systemLeaderboardModal.addEventListener('click', (e) => { if (e.target === systemLeaderboardModal) hideSystemLeaderboardModal(); });

    
    const debouncedFilter = debounce(handleFilterChange, 300);
    if (searchInput) searchInput.addEventListener('input', debouncedFilter);
    if (sortSelect) sortSelect.addEventListener('change', handleFilterChange);
    if (resetButton) resetButton.addEventListener('click', resetAll);
    
    if (collectionViewBtn) collectionViewBtn.addEventListener('click', () => switchView('collection'));
    if (walletViewBtn) walletViewBtn.addEventListener('click', () => switchView('wallet'));
    if (mapViewBtn) mapViewBtn.addEventListener('click', () => switchView('map'));


    if (walletResetBtn) {
        walletResetBtn.addEventListener('click', () => {
            if (walletSearchAddressInput) walletSearchAddressInput.value = '';
            if (walletGallery) walletGallery.innerHTML = '';
            if (walletGalleryTitle) walletGalleryTitle.textContent = 'Wallet NFTs';
             document.querySelectorAll('#leaderboard-table .leaderboard-row').forEach(row => {
                row.classList.remove('selected');
            });
            showLoading(walletGallery,'Search for or select a wallet to see owned NFTs.'); // Reset gallery text
        });
    }

    if (walletSearchAddressInput) {
        walletSearchAddressInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchWallet();
        });
    }
    
    if (searchAddressInput) {
        searchAddressInput.addEventListener('input', () => {
            handleAddressInput(searchAddressInput, addressSuggestions, handleFilterChange, false);
        });
    }
    
    if (walletSearchAddressInput) {
        walletSearchAddressInput.addEventListener('input', () => {
            handleAddressInput(walletSearchAddressInput, walletAddressSuggestions, searchWallet, true);
        });
    }

    if (leaderboardTable) {
        leaderboardTable.addEventListener('click', (e) => {
            const headerCell = e.target.closest('[data-sort-by]');
            if (!headerCell) return;

            const newColumn = headerCell.dataset.sortBy;
            if (holderSort.column === newColumn) {
                holderSort.direction = holderSort.direction === 'desc' ? 'asc' : 'desc';
            } else {
                holderSort.column = newColumn;
                holderSort.direction = (newColumn === 'address') ? 'asc' : 'desc'; // Default text to A-Z
            }
            sortAndDisplayHolders();
        });
    }


     const setupCopyButton = (buttonEl, inputEl) => {
         if (buttonEl && inputEl) { // Add null check
            buttonEl.addEventListener('click', () => copyToClipboard(inputEl.value));
         }
     };

    setupCopyButton(copyAddressBtn, searchAddressInput);
    setupCopyButton(walletCopyAddressBtn, walletSearchAddressInput);
    
    // Map listeners
    addMapListeners(); // Add map listeners
    window.addEventListener('resize', handleMapResize); // Add resize listener
    window.addEventListener('hashchange', handleHashChange); // Add hashchange listener
};

function switchView(viewName) {
    if (viewName !== 'map' && globalAnimationFrameId) {
        cancelAnimationFrame(globalAnimationFrameId);
        globalAnimationFrameId = null;
        // isMapInitialized = false; // Keep map initialized but stop animation
    }
    if (collectionView) collectionView.classList.add('hidden');
    if (walletView) walletView.classList.add('hidden');
    if (mapView) mapView.classList.add('hidden');
    if (collectionViewBtn) collectionViewBtn.classList.remove('active');
    if (walletViewBtn) walletViewBtn.classList.remove('active');
    if (mapViewBtn) mapViewBtn.classList.remove('active');

    if (viewName === 'collection') {
        if (collectionView) collectionView.classList.remove('hidden');
        if (collectionViewBtn) collectionViewBtn.classList.add('active');
    } else if (viewName === 'wallet') {
        if (walletView) walletView.classList.remove('hidden');
        if (walletViewBtn) walletViewBtn.classList.add('active');
    } else if (viewName === 'map') {
        if (mapView) mapView.classList.remove('hidden');
        if (mapViewBtn) mapViewBtn.classList.add('active');
        requestAnimationFrame(initializeStarfield); // Use requestAnimationFrame
    }
}

const updateAddressDropdown = (nftList) => {
    const ownerCounts = {};
    // Count NFTs *only* from the provided list (filtered or all)
    nftList.forEach(nft => {
        if (nft.owner) {
            ownerCounts[nft.owner] = (ownerCounts[nft.owner] || 0) + 1;
        }
    });

    // Sort owners by the new counts
    const sortedOwners = Object.entries(ownerCounts)
        .sort(([, countA], [, countB]) => countB - countA);

    // Remember the currently selected value before clearing
    const currentSelectedAddress = addressDropdown.value;
    let selectionStillExists = false;

    // Clear existing options (except the first "Holders" option)
    while (addressDropdown.options.length > 1) {
        addressDropdown.remove(addressDropdown.options.length - 1);
    }

    // Populate with new sorted owners and counts
    sortedOwners.forEach(([address, count]) => {
        const option = document.createElement('option');
        option.value = address;
        option.textContent = `(${count}) ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        addressDropdown.appendChild(option);
        // Check if the previously selected address is in the new list
        if (address === currentSelectedAddress) {
            selectionStillExists = true;
        }
    });

    // Re-select the previous address if it still exists in the filtered list
    if (selectionStillExists) {
        addressDropdown.value = currentSelectedAddress;
    } else {
        // If the previously selected holder is filtered out,
        // check if the address input field still has a value.
        // If the input field *also* doesn't match anyone in the new list,
        // reset the dropdown to the default "Holders".
        const currentInputAddress = searchAddressInput.value;
        const inputAddressExists = sortedOwners.some(([adr]) => adr === currentInputAddress);
        if (!inputAddressExists) {
             addressDropdown.value = ""; // Reset to default "Holders"
             // Optionally clear the input field if the dropdown drove the filter
             // searchAddressInput.value = "";
        } else {
            // Keep the dropdown showing the address from the input field if it exists
            addressDropdown.value = currentInputAddress;
        }
    }
};

// --- Collection View Logic ---
const applyFiltersAndSort = () => {
    let tempNfts = [...allNfts];

    // Address Search
    const addressSearchTerm = searchAddressInput.value.trim().toLowerCase();
    if(addressSearchTerm) {
        // Use endsWith for partial matching from the end, or full match
        tempNfts = tempNfts.filter(nft => 
            nft.owner && 
            (nft.owner.toLowerCase() === addressSearchTerm || 
            (addressSearchTerm.length < 42 && nft.owner.toLowerCase().endsWith(addressSearchTerm)))
        );
    }
    
    // --- Status Filters ---
    if (document.querySelector('.status-toggle-cb[data-key="staked"]')?.checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="staked"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.staked_enterprise_legacy);
        else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.staked_enterprise_legacy || nft.staked_daodao);
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.staked_daodao);
    }
    if (document.querySelector('.status-toggle-cb[data-key="listed"]')?.checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="listed"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.boost_market);
        else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.boost_market || nft.bbl_market);
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.bbl_market);
    }
    if (document.querySelector('.status-toggle-cb[data-key="rewards"]')?.checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="rewards"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.broken === true);
        else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.broken !== undefined); // All that have the property
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.broken === false);
    }
     if (document.querySelector('.status-toggle-cb[data-key="mint_status"]')?.checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="mint_status"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.owned_by_alliance_dao === true); // Use combined DAO property
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.owned_by_alliance_dao === false);
    }
    // *** ADDED LIQUID FILTER LOGIC ***
    if (document.querySelector('.status-toggle-cb[data-key="liquid_status"]')?.checked) {
        const sliderValue = document.querySelector('.direction-slider[data-slider-key="liquid_status"]').value;
        if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.liquid === true);
        else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.liquid === false);
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
    if (sortValue === 'asc') tempNfts.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
    else if (sortValue === 'desc') tempNfts.sort((a, b) => (b.rank ?? -Infinity) - (a.rank ?? -Infinity));
    else if (sortValue === 'id') tempNfts.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    filteredNfts = tempNfts;
    if (resultsCount) resultsCount.textContent = filteredNfts.length;
    updateFilterCounts(filteredNfts);
    updateAddressDropdown(filteredNfts);
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
        // Check if it's one of the filter toggles
        if (['status-toggle-cb', 'planet-toggle-cb', 'inhabitant-toggle-cb'].some(cls => toggle.classList.contains(cls))) {
            params.set(toggle.dataset.key, 'true');
            const slider = document.querySelector(`.direction-slider[data-slider-key="${toggle.dataset.key}"]`);
            if(slider && !slider.disabled) { // Only save slider pos if it's enabled
                params.set(`${toggle.dataset.key}_pos`, slider.value);
            }
        }
    });
    
    try {
        // Use replaceState to avoid cluttering browser history
        const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`; // Keep hash
        history.replaceState({}, '', newUrl);
    } catch (e) { console.warn("Could not update URL state."); }
};

const applyStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    if (searchInput) searchInput.value = params.get('id') || '';
    if (searchAddressInput) searchAddressInput.value = params.get('address') || '';
    
    // Validate sort param before setting it
    const sortParam = params.get('sort');
    if (sortSelect && [...sortSelect.options].some(o => o.value === sortParam)) {
        sortSelect.value = sortParam;
    } else if (sortSelect) {
        sortSelect.value = 'asc';
    }
    
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
        if (['status-toggle-cb', 'planet-toggle-cb', 'inhabitant-toggle-cb'].some(cls => toggle.classList.contains(cls))) {
            const key = toggle.dataset.key;
            if (params.get(key) === 'true') {
                toggle.checked = true;
                const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`);
                if(slider) {
                    slider.disabled = false;
                    slider.value = params.get(`${key}_pos`) || '1';
                }
            }
        }
    });
};

const updateMultiSelectButtonText = (container) => {
    const buttonSpan = container.querySelector('.multi-select-button span');
    const traitCheckbox = container.querySelector('.multi-select-checkbox');
    if (!buttonSpan || !traitCheckbox) return; // Safety check
    
    const traitType = traitCheckbox.dataset.trait;
    const checkedCount = container.querySelectorAll('.multi-select-checkbox:checked').length;
    const totalCount = container.querySelectorAll('.multi-select-checkbox').length;
    
    if (checkedCount === 0 || checkedCount === totalCount) {
        buttonSpan.textContent = `All ${traitType}s`;
    } else {
        buttonSpan.textContent = `${checkedCount} ${traitType}(s) selected`;
    }
};

const closeAllDropdowns = (exceptThisOne = null) => {
    document.querySelectorAll('.multi-select-dropdown').forEach(d => {
        if (d !== exceptThisOne) d.classList.add('hidden');
    });
    if (addressSuggestions) addressSuggestions.classList.add('hidden');
    if (walletAddressSuggestions) walletAddressSuggestions.classList.add('hidden');
};

const displayPage = (page) => {
    currentPage = page;
    if (!gallery) return;
    gallery.innerHTML = '';
    if (filteredNfts.length === 0) {
        showLoading(gallery, 'No NFTs match the current filters.');
        updatePaginationControls(0);
        return;
    }
    const totalPages = Math.ceil(filteredNfts.length / itemsPerPage);
    page = Math.max(1, Math.min(page, totalPages)); // Clamp page number
    currentPage = page; // Update global state
    
    const pageItems = filteredNfts.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    pageItems.forEach(nft => gallery.appendChild(createNftCard(nft, '.trait-toggle')));
    updatePaginationControls(totalPages);
};

const createNftCard = (nft, toggleSelector) => {
    const card = document.createElement('div');
    card.className = 'nft-card bg-gray-800 border border-gray-700 rounded-xl overflow-hidden flex flex-col';
    card.addEventListener('click', () => showNftDetails(nft));
    const imageUrl = convertIpfsUrl(nft.thumbnail_image || nft.image) || `https://placehold.co/300x300/1f2937/e5e7eb?text=No+Image`;
    const newTitle = (nft.name || `NFT #${nft.id || '?'}`).replace('The AllianceDAO NFT', 'AllianceDAO NFT');

    let traitsHtml = '';
    const visibleTraits = traitOrder.filter(t => {
        const toggle = document.querySelector(`${toggleSelector}[data-trait="${t}"]`);
        return toggle && toggle.checked;
    });
    
    visibleTraits.forEach(traitType => {
        let value = 'N/A';
        if (traitType === 'Rank' && nft.rank != null) {
            value = `#${nft.rank}`;
        } else if (traitType === 'Rarity') {
    value = nft.attributes?.find(a => a.trait_type === 'Rarity')?.value || 'N/A';
        } else {
            value = nft.attributes?.find(attr => attr.trait_type === traitType)?.value || 'N/A';
        }
        traitsHtml += `<li class="flex justify-between items-center py-2 px-1 border-b border-gray-700 last:border-b-0"><span class="text-xs font-medium text-cyan-400 uppercase">${traitType}</span><span class="text-sm font-semibold text-white truncate" title="${value}">${value}</span></li>`;
    });
    
    card.innerHTML = `<div class="image-container aspect-w-1-aspect-h-1 w-full"><img src="${imageUrl}" alt="${newTitle}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null; this.src='https://placehold.co/300x300/1f2937/e5e7eb?text=Image+Error'; this.alt='Image Error';"></div><div class="p-4 flex-grow flex flex-col"><h2 class="text-lg font-bold text-white mb-3 truncate" title="${newTitle}">${newTitle}</h2><ul class="text-sm flex-grow">${traitsHtml}</ul></div>`;
    
    const imageContainer = card.querySelector('.image-container');
    if (!imageContainer) return card; // Safety check
    
    const isDaoOwned = nft.owned_by_alliance_dao; // Use the combined property
    const hasBadges = nft.broken || nft.staked_daodao || nft.boost_market || nft.bbl_market || nft.staked_enterprise_legacy || isDaoOwned;

    if (hasBadges) {
        // --- Add Badge Visibility Toggle ---
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button'; // Explicitly set type
        toggleButton.className = 'top-left-toggle';
        toggleButton.title = 'Toggle badge visibility';
        toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`; // Eye icon

        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation(); // IMPORTANT: Prevents the modal from opening
            const isHidden = imageContainer.classList.toggle('badges-hidden');
            toggleButton.innerHTML = isHidden 
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>` // Eye-off icon
                : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`; // Eye icon
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

    // Helper function to add badges
    const addBadge = (src, alt) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.title = alt; // Add title for hover tooltip
        img.className = 'overlay-icon';
        topRightStack.appendChild(img);
    };

    if (isDaoOwned) addBadge('https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/Alliance%20DAO%20Logo.png', 'Owned by DAO');
    if (nft.staked_daodao) addBadge('https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/DAODAO.png', 'Staked on DAODAO');
    if (nft.boost_market) addBadge('https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/Boost%20Logo.png', 'Listed on Boost');
    if (nft.bbl_market) addBadge('https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/BBL%20No%20Background.png', 'Listed on BBL');
    if (nft.staked_enterprise_legacy) addBadge('https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/Enterprise.jpg', 'Staked on Enterprise');

    if (topRightStack.children.length > 0) {
        imageContainer.appendChild(topRightStack);
    }

    return card;
};

const updatePaginationControls = (totalPages) => {
    if (!paginationControls) return;
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
    if(searchInput) searchInput.value = '';
    if(searchAddressInput) searchAddressInput.value = '';
    if(addressDropdown) addressDropdown.value = '';
    if(sortSelect) sortSelect.value = 'asc';
    
    document.querySelectorAll('.toggle-checkbox').forEach(toggle => {
        if (['status-toggle-cb', 'planet-toggle-cb', 'inhabitant-toggle-cb'].some(cls => toggle.classList.contains(cls))) {
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


const updateFilterCounts = (currentNfts) => { // Pass in the list to count
    const newCounts = {};
    const curInhabCounts = {};
    const curPlanCounts = {};
    
    currentNfts.forEach(nft => {
        if (nft.attributes) {
            nft.attributes.forEach(attr => {
                if (!newCounts[attr.trait_type]) newCounts[attr.trait_type] = {};
                newCounts[attr.trait_type][attr.value] = (newCounts[attr.trait_type][attr.value] || 0) + 1;
                
                if (attr.trait_type === 'Inhabitant') {
                    const baseName = attr.value.replace(/ (M|F)$/, '');
                    if (!curInhabCounts[baseName]) curInhabCounts[baseName] = { total: 0, male: 0, female: 0 };
                    curInhabCounts[baseName].total++;
                    if (attr.value.endsWith(' M')) curInhabCounts[baseName].male++;
                    if (attr.value.endsWith(' F')) curInhabCounts[baseName].female++;
                }
                if (attr.trait_type === 'Planet') {
                    const baseName = attr.value.replace(/ (North|South)$/, '');
                    if (!curPlanCounts[baseName]) curPlanCounts[baseName] = { total: 0, north: 0, south: 0 };
                    curPlanCounts[baseName].total++;
                    if (attr.value.endsWith(' North')) curPlanCounts[baseName].north++;
                    if (attr.value.endsWith(' South')) curPlanCounts[baseName].south++;
                }
            });
        }
    });

    document.querySelectorAll('.multi-select-container').forEach(container => {
        const traitType = container.querySelector('[data-trait]')?.dataset.trait;
        if (!traitType) return;
        container.querySelectorAll('label').forEach(label => {
            const checkbox = label.querySelector('input');
            if (!checkbox) return;
            const value = checkbox.value;
            const countSpan = label.querySelector('.trait-count');
            const count = newCounts[traitType]?.[value] || 0;
            if (countSpan) countSpan.textContent = count;
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
        const counts = curInhabCounts[name] || { male: 0, female: 0, total: 0 };
        if (slider) {
            if (slider.value === '0') countSpan.textContent = counts.male;
            else if (slider.value === '1') countSpan.textContent = counts.total;
            else if (slider.value === '2') countSpan.textContent = counts.female;
        } else {
             countSpan.textContent = counts.total;
        }
    });

    document.querySelectorAll('.planet-count').forEach(countSpan => {
        const name = countSpan.dataset.countKey;
        const slider = document.querySelector(`.direction-slider[data-slider-key="${name}"]`);
        const counts = curPlanCounts[name] || { north: 0, south: 0, total: 0 };
        if (slider) {
            if (slider.value === '0') countSpan.textContent = counts.north;
            else if (slider.value === '1') countSpan.textContent = counts.total;
            else if (slider.value === '2') countSpan.textContent = counts.south;
        } else {
            countSpan.textContent = counts.total;
        }
    });
    // Update Status Filter Counts
    document.querySelectorAll('.status-count').forEach(countSpan => {
        const key = countSpan.dataset.countKey;
        const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`);
        if (!slider) return;

        let count = 0;
        const list = currentNfts; // Use the passed-in list
        
        if (key === 'staked') {
             const enterpriseCount = list.filter(n => n.staked_enterprise_legacy).length;
             const daodaoCount = list.filter(n => n.staked_daodao).length;
             if(slider.value === '0') count = enterpriseCount;
             else if (slider.value === '1') count = list.filter(n => n.staked_enterprise_legacy || n.staked_daodao).length;
             else if (slider.value === '2') count = daodaoCount;
        } else if (key === 'listed') {
            const boostCount = list.filter(n => n.boost_market).length;
            const bblCount = list.filter(n => n.bbl_market).length;
            if(slider.value === '0') count = boostCount;
            else if (slider.value === '1') count = list.filter(n => n.boost_market || n.bbl_market).length;
            else if (slider.value === '2') count = bblCount;
        } else if (key === 'rewards') {
             const brokenCount = list.filter(n => n.broken === true).length;
             const unbrokenCount = list.filter(n => n.broken === false).length;
             if(slider.value === '0') count = brokenCount;
             else if (slider.value === '1') count = brokenCount + unbrokenCount;
             else if (slider.value === '2') count = unbrokenCount;
        } else if (key === 'mint_status') {
            const unmintedCount = list.filter(n => n.owned_by_alliance_dao === true).length;
            const mintedCount = list.filter(n => n.owned_by_alliance_dao === false).length;
            if(slider.value === '0') count = unmintedCount;
            else if (slider.value === '1') count = unmintedCount + mintedCount;
            else if (slider.value === '2') count = mintedCount;
        } else if (key === 'liquid_status') { // *** ADDED LIQUID COUNT ***
            const liquidCount = list.filter(n => n.liquid === true).length;
            const notLiquidCount = list.filter(n => n.liquid === false).length;
            if(slider.value === '0') count = liquidCount;
            else if (slider.value === '1') count = liquidCount + notLiquidCount;
            else if (slider.value === '2') count = notLiquidCount;
        }
        countSpan.textContent = count;
    });
};

// --- Modal and Preview Logic ---
const findHighestRaritySample = (filterFn) => {
    // Find the highest *score* (lowest rank)
    const matches = allNfts.filter(filterFn);
    if (matches.length === 0) return null;
    matches.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)); // Sort by rank asc
    return matches[0];
};

const showPreviewTile = (event, traitType, value) => {
    const previewTile = document.getElementById('preview-tile');
    const container1 = document.getElementById('preview-container-1');
    const image1 = document.getElementById('preview-image-1');
    const name1 = document.getElementById('preview-name-1');
    const container2 = document.getElementById('preview-container-2');
    const image2 = document.getElementById('preview-image-2');
    const name2 = document.getElementById('preview-name-2');
    
    if (!previewTile || !container1 || !image1 || !name1 || !container2 || !image2 || !name2) return;
    
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
            if (!sample1 && !sample2) sample1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value.startsWith(value)));
            else if (!sample1) sample1 = sample2; // If only F/South exists, show it in box 1
        } else {
            const suffix = (traitType === 'Inhabitant' ? (sliderValue === '0' ? ' M' : ' F') : (sliderValue === '0' ? ' North' : ' South'));
            sample1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suffix));
        }
    }
    
    const placeholder = `https://placehold.co/128x128/374151/9ca3af?text=N/A`;
    
    if (sample1) {
        image1.src = convertIpfsUrl(sample1.thumbnail_image || sample1.image) || placeholder;
        name1.textContent = sample1.attributes?.find(a => a.trait_type === traitType)?.value || value;
        container1.classList.remove('hidden');
    } else { container1.classList.add('hidden'); image1.src=''; name1.textContent=''; }
    
    if (sample2) {
        image2.src = convertIpfsUrl(sample2.thumbnail_image || sample2.image) || placeholder;
        name2.textContent = sample2.attributes?.find(a => a.trait_type === traitType)?.value || value;
        container2.classList.remove('hidden');
    } else { container2.classList.add('hidden'); image2.src=''; name2.textContent=''; }

    if (sample1 || sample2) {
        const tileWidth = sample2 ? 330 : 160;
        let x = event.clientX + 20;
        let y = event.clientY + 10;
        if (x + tileWidth > window.innerWidth) { x = event.clientX - tileWidth - 20; }
        if (y + previewTile.offsetHeight > window.innerHeight) { y = window.innerHeight - previewTile.offsetHeight - 10; }
        if (x < 0) x = 10;
        if (y < 0) y = 10;
        
        previewTile.style.left = `${x}px`;
        previewTile.style.top = `${y}px`;
        previewTile.classList.remove('hidden');
    } else {
        hidePreviewTile();
    }
};

const hidePreviewTile = () => {
    const previewTile = document.getElementById('preview-tile');
    if (previewTile) previewTile.classList.add('hidden');
};

const showCopyToast = (text) => {
    if (!copyToast) return;
    copyToast.textContent = text;
    copyToast.classList.add('show');
    setTimeout(() => { copyToast.classList.remove('show'); }, 2000);
}

const copyToClipboard = (textToCopy, typeName = 'Address') => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const shortText = textToCopy.length > 10 ? `${textToCopy.substring(0, 5)}...${textToCopy.substring(textToCopy.length - 5)}` : textToCopy;
        showCopyToast(`Copied ${typeName}: ${shortText}`);
    }).catch(err => {
        console.error('Clipboard copy failed, falling back to execCommand:', err);
        try {
            const tempInput = document.createElement('textarea'); // Use textarea for better compatibility
            tempInput.value = textToCopy;
            tempInput.style.position = 'absolute';
            tempInput.style.left = '-9999px';
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            const shortText = textToCopy.length > 10 ? `...` : textToCopy;
            showCopyToast(`Copied ${typeName}: ${shortText}`);
        } catch (e) {
            console.error('Fallback copy failed:', e);
            showCopyToast(`Copy Failed!`);
        }
    });
};
const showNftDetails = (nft) => {
    if (!nftModal || !nft) return;
    const imgEl = document.getElementById('modal-image');
    const titleEl = document.getElementById('modal-title');
    const traitsEl = document.getElementById('modal-traits');
    const linkEl = document.getElementById('modal-link');
    const dlBtn = document.getElementById('download-post-btn');
    
    if(!imgEl || !titleEl || !traitsEl || !linkEl || !dlBtn) return; // Safety check
    
    imgEl.src = convertIpfsUrl(nft.image) || `https://placehold.co/400x400/1f2937/e5e7eb?text=No+Image`;
    titleEl.textContent = (nft.name || `NFT #${nft.id || '?'}`).replace('The AllianceDAO NFT', 'AllianceDAO NFT');
    
    // Get the "Rarity" trait value, default to 'N/A'
    const rarityValue = nft.attributes?.find(a => a.trait_type === 'Rarity')?.value || 'N/A';

    // Start traits HTML with Rank and the corrected Rarity value
    let traitsHtml = `<div class="flex justify-between text-sm"><span class="text-gray-400">Rank:</span><span class="font-semibold text-white">#${nft.rank || 'N/A'}</span></div>`;
    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Rarity:</span><span class="font-semibold text-white">${rarityValue}</span></div>`;
    
    // Filter and sort the *rest* of the attributes
    const attributesToShow = (nft.attributes || [])
        .filter(a => traitOrder.includes(a.trait_type) && !['Rank', 'Rarity'].includes(a.trait_type))
        .sort((a, b) => traitOrder.indexOf(a.trait_type) - traitOrder.indexOf(b.trait_type));
        
    // Add the filtered attributes to the HTML
    traitsHtml += attributesToShow.map(attr => 
        `<div class="flex justify-between text-sm"><span class="text-gray-400">${attr.trait_type}:</span><span class="font-semibold text-white truncate" title="${attr.value}">${attr.value || 'N/A'}</span></div>`
    ).join('');
    
    // Separator line
    traitsHtml += `<div class="pt-2 mt-2 border-t border-gray-600"></div>`;
    
    // Status Text Logic (same as before)
    let statusTxt = 'Unknown';
    if (nft.owned_by_alliance_dao) {
        statusTxt = 'DAO Owned (Un-minted)';
    } else if (nft.liquid === true) {
        statusTxt = 'Liquid (In Wallet)';
    } else if (nft.staked_daodao) {
        statusTxt = 'Staked (DAODAO)';
    } else if (nft.staked_enterprise_legacy) {
        statusTxt = 'Staked (Enterprise)';
    } else if (nft.bbl_market) {
        statusTxt = 'Listed (BackBone Labs)';
    } else if (nft.boost_market) {
        statusTxt = 'Listed (Boost)';
    } else if (nft.liquid === false) {
        statusTxt = 'In Wallet (Not Liquid)'; // Catch-all for non-liquid
    }

    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Status:</span><span class="font-semibold text-white">${statusTxt}</span></div>`;
    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Broken:</span><span class="font-semibold text-white">${nft.broken ? 'Yes' : 'No'}</span></div>`;
    
    // Separator line
    traitsHtml += `<div class="pt-2 mt-2 border-t border-gray-600"></div>`;
    
    // Owner Info (same as before)
    traitsHtml += `<div class="flex justify-between text-sm items-center"><span class="text-gray-400">Owner:</span><span class="owner-address font-mono text-sm font-semibold text-white truncate cursor-pointer" title="Click to copy">${nft.owner || 'N/A'}</span></div>`;

    // Update the DOM
    traitsEl.innerHTML = traitsHtml;
    
    // Add click listener for owner address copy
    const ownerEl = traitsEl.querySelector('.owner-address');
    if (nft.owner && ownerEl) {
        ownerEl.addEventListener('click', () => copyToClipboard(nft.owner, 'Owner Address'));
    } else if (ownerEl) {
        ownerEl.style.cursor = 'default';
        ownerEl.removeAttribute('title');
    }

    // Update IPFS link and Download button (same as before)
    linkEl.href = convertIpfsUrl(nft.image) || '#';
    dlBtn.textContent = 'Download Post';
    dlBtn.disabled = false;
    dlBtn.onclick = () => generateShareImage(nft, dlBtn); 

    // Update hash and show modal (same as before)
    window.location.hash = nft.id || ''; 
    nftModal.classList.remove('hidden');
};

;

const hideNftDetails = () => {
    if (nftModal) nftModal.classList.add('hidden');
    // Clear hash without adding to history
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
};

const findRarestTrait = (nft) => {
    if (!nft.attributes || !traitCounts) return { value: 'N/A', trait_type: 'Unknown' };

    let rarestTrait = null;
    let minCount = Infinity;

    nft.attributes.forEach(attr => {
        // Only count traits that contribute to rarity score
        if (traitCounts[attr.trait_type]?.[attr.value] && !['Weather', 'Light'].includes(attr.trait_type)) {
            const count = traitCounts[attr.trait_type][attr.value];
            if (count < minCount) {
                minCount = count;
                rarestTrait = attr;
            }
        }
    });
    return rarestTrait || { value: 'N/A', trait_type: 'Unknown' };
};

const generateShareImage = (nft, button) => {
    if (!button) return;
    button.textContent = 'Generating...';
    button.disabled = true;
    
    const canvas = document.getElementById('share-canvas');
    if (!canvas) {
        button.textContent = 'Error';
        return;
    }
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    const imgUrl = convertIpfsUrl(nft.image) || convertIpfsUrl(nft.thumbnail_image);
    if (!imgUrl) {
        button.textContent = 'No Image';
        setTimeout(() => { button.textContent = 'Download Post'; button.disabled = false; }, 2000);
        return;
    }
    img.src = imgUrl;

    img.onload = () => {
        canvas.width = 1080; canvas.height = 1080;
        ctx.clearRect(0, 0, 1080, 1080);
        try {
            ctx.drawImage(img, 0, 0, 1080, 1080);
        } catch (e) {
            console.error("Error drawing image to canvas:", e);
            button.textContent = 'Draw Error';
            setTimeout(() => { button.textContent = 'Download Post'; button.disabled = false; }, 2000);
            return;
        }

        const getTrait = (type) => nft.attributes?.find(a => a.trait_type === type)?.value || 'N/A';
        ctx.fillStyle = 'white'; ctx.strokeStyle = 'black';
        ctx.lineWidth = 8; ctx.font = 'bold 48px Inter, sans-serif';
        ctx.lineJoin = 'round'; // Smoother text corners
        const margin = 40;

        const drawText = (text, x, y, align = 'left') => {
            ctx.textAlign = align;
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
        };

        drawText(`NFT #${nft.id || '?'}`, margin, margin + 48, 'left');
        drawText(`Rank #${nft.rank || 'N/A'}`, canvas.width - margin, margin + 48, 'right');
        drawText(getTrait('Planet'), margin, canvas.height - margin, 'left');
        
        let inhabitantText = getTrait('Inhabitant');
        if (inhabitantText.endsWith(' M')) inhabitantText = inhabitantText.replace(' M', ' Male');
        else if (inhabitantText.endsWith(' F')) inhabitantText = inhabitantText.replace(' F', ' Female');
        drawText(inhabitantText, canvas.width - margin, canvas.height - margin, 'right');
        
        const bannerHeight = 120;
        const bannerY = canvas.height - bannerHeight - 80;
        
        if (nft.broken) {
            ctx.fillStyle = 'rgba(220, 38, 38, 0.85)'; // Red
            ctx.fillRect(0, bannerY, canvas.width, bannerHeight);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 60px Inter, sans-serif';
            drawText('BROKEN', canvas.width / 2, bannerY + 85, 'center');
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Dark
            ctx.fillRect(0, bannerY, canvas.width, bannerHeight);
            const strength = findRarestTrait(nft);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 40px Inter, sans-serif';
            drawText(`Rarest: ${strength.value || 'N/A'}`, canvas.width / 2, bannerY + 75, 'center');
        }
        
        try {
            const link = document.createElement('a');
            link.download = `AllianceDAO_NFT_${nft.id || 'Unknown'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            button.textContent = 'Downloaded!';
        } catch(e) {
            console.error("Error creating download link:", e);
            button.textContent = 'DL Failed';
        }

        setTimeout(() => { button.textContent = 'Download Post'; button.disabled = false; }, 2000);
    };
    img.onerror = () => {
        console.error("Could not load image to generate post for download.");
        button.textContent = 'Load Error';
        setTimeout(() => { button.textContent = 'Download Post'; button.disabled = false; }, 3000);
    }
};

// --- Wallet View Logic ---
const calculateAndDisplayLeaderboard = () => {
    if (allNfts.length === 0) return;

    const ownerStats = {};
    allNfts.forEach(nft => {
        if (nft.owner) {
            if (!ownerStats[nft.owner]) {
                 ownerStats[nft.owner] = { address: nft.owner, total: 0, liquid: 0, daodaoStaked: 0, enterpriseStaked: 0, broken: 0, unbroken: 0, bblListed: 0, boostListed: 0 };
            }
            const stats = ownerStats[nft.owner];
            stats.total++;
            if (nft.liquid) stats.liquid++; // Use pre-calculated liquid status
            if (nft.staked_daodao) stats.daodaoStaked++;
            if (nft.staked_enterprise_legacy) stats.enterpriseStaked++;
            if (nft.bbl_market) stats.bblListed++;
            if (nft.boost_market) stats.boostListed++;
            if (nft.broken) stats.broken++;
            else stats.unbroken++; // Count unbroken
        }
    });

    allHolderStats = Object.values(ownerStats); // No need to map, liquid is already counted
    sortAndDisplayHolders();
};

const sortAndDisplayHolders = () => {
    const { column, direction } = holderSort;
    allHolderStats.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        if (column === 'address') {
            return direction === 'asc' ? (valA || '').localeCompare(valB || '') : (valB || '').localeCompare(valA || '');
        } else {
            // Handle numbers
            const numA = typeof valA === 'number' ? valA : -Infinity;
            const numB = typeof valB === 'number' ? valB : -Infinity;
            return direction === 'asc' ? numA - numB : numB - numA;
        }
    });
    displayHolderPage(1);
};

const displayHolderPage = (page) => {
    if (!leaderboardTable) return;
    holderCurrentPage = page;
    leaderboardTable.innerHTML = ''; 

    const header = document.createElement('div');
    header.className = 'leaderboard-header';
    // Updated grid columns for new fields
    header.style.gridTemplateColumns = 'minmax(60px, 1fr) 2.5fr repeat(8, 1fr)'; 
    
    const createHeaderCell = (label, columnKey, isCentered = true) => {
        const isSortCol = holderSort.column === columnKey;
        const ascActive = isSortCol && holderSort.direction === 'asc';
        const descActive = isSortCol && holderSort.direction === 'desc';
        const activeClass = isSortCol ? 'sort-active' : '';
        return `<span data-sort-by="${columnKey}" class="${isCentered ? 'text-center' : ''} ${activeClass}">${label}<svg class="sort-icon w-4 h-4 inline-block ${ascActive ? 'active' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg><svg class="sort-icon w-4 h-4 inline-block ${descActive ? 'active' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></span>`;
    };

    header.innerHTML = `<span>Rank</span>` + // Rank is not sortable
                         createHeaderCell('Holder', 'address', false) +
                         createHeaderCell('Liquid', 'liquid') +
                         createHeaderCell('DAODAO', 'daodaoStaked') +
                         createHeaderCell('Enterprise', 'enterpriseStaked') +
                         createHeaderCell('Broken', 'broken') +
                         createHeaderCell('Unbroken', 'unbroken') +
                         createHeaderCell('BBL', 'bblListed') + // Shorter name
                         createHeaderCell('Boost', 'boostListed') + // Shorter name
                         createHeaderCell('Total', 'total');

    leaderboardTable.appendChild(header);

    const pageItems = allHolderStats.slice((page - 1) * holdersPerPage, page * holdersPerPage);

    pageItems.forEach(({ address, ...stats }, index) => {
        const rank = (page - 1) * holdersPerPage + index + 1;
        const item = document.createElement('div');
        item.className = 'leaderboard-row';
        item.style.gridTemplateColumns = 'minmax(60px, 1fr) 2.5fr repeat(8, 1fr)';
        item.dataset.address = address;
        const shortAddress = address ? `terra...${address.substring(address.length - 4)}` : 'N/A';

        item.innerHTML = `
            <span class="text-center font-bold">#${rank}</span>
            <span class="font-mono text-sm truncate" title="${address || ''}">${shortAddress}</span>
            <span class="text-center">${stats.liquid || 0}</span>
            <span class="text-center ${stats.daodaoStaked > 0 ? 'text-cyan-400' : ''}">${stats.daodaoStaked || 0}</span>
            <span class="text-center ${stats.enterpriseStaked > 0 ? 'text-gray-400' : ''}">${stats.enterpriseStaked || 0}</span>
            <span class="text-center ${stats.broken > 0 ? 'text-red-400' : ''}">${stats.broken || 0}</span>
            <span class="text-center ${stats.unbroken > 0 ? 'text-green-400' : ''}">${stats.unbroken || 0}</span>
            <span class="text-center ${stats.bblListed > 0 ? 'text-green-400' : ''}">${stats.bblListed || 0}</span>
            <span class="text-center ${stats.boostListed > 0 ? 'text-purple-400' : ''}">${stats.boostListed || 0}</span>
            <span class="font-bold text-center">${stats.total || 0}</span>
        `;
        item.addEventListener('click', () => {
            if (address) {
                walletSearchAddressInput.value = address;
                searchWallet();
                // Highlight this row
                document.querySelectorAll('#leaderboard-table .leaderboard-row').forEach(r => r.classList.remove('selected'));
                item.classList.add('selected');
            }
        });
        leaderboardTable.appendChild(item);
    });
    updateHolderPaginationControls();
};

const updateHolderPaginationControls = () => {
    if (!leaderboardPagination) return;
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
// Map listeners
const handleMapContextMenu = (e) => e.preventDefault();
const handleMapMouseDown = (e) => {
    e.preventDefault();
    if (e.button === 1 || e.ctrlKey || e.metaKey) { // Middle mouse or Ctrl/Cmd click
        isRotating = true;
        isPanning = false;
        if(spaceCanvas) spaceCanvas.style.cursor = 'ew-resize';
    } else if (e.button === 0) { // Left click
        isPanning = true;
        isRotating = false;
        if(spaceCanvas) spaceCanvas.style.cursor = 'grabbing';
    }
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
};
const handleMapMouseUp = (e) => {
    e.preventDefault();
    isPanning = false;
    isRotating = false;
    if(spaceCanvas) spaceCanvas.style.cursor = 'grab';
};
const handleMapMouseLeave = () => {
    if (isPanning || isRotating) {
        isPanning = false;
        isRotating = false;
        if(spaceCanvas) spaceCanvas.style.cursor = 'grab';
    }
};
const handleMapMouseMove = (e) => {
    if (!spaceCanvas) return;
    const rect = spaceCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // Skip if canvas not visible

    // Check if mouse is inside canvas bounds
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (mouseX < 0 || mouseX > spaceCanvas.width || mouseY < 0 || mouseY > spaceCanvas.height) {
        // Mouse left the canvas area, stop panning/rotating
        if (isPanning || isRotating) {
            isPanning = false;
            isRotating = false;
            if(spaceCanvas) spaceCanvas.style.cursor = 'grab';
        }
        return;
    }

    // Convert mouse coords to world coords
    const currentZoom = (mapZoom === 0) ? 0.0001 : mapZoom; // Avoid divide by zero
    const worldX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / currentZoom;
    const worldY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / currentZoom;
    const sinR = Math.sin(-mapRotation);
    const cosR = Math.cos(-mapRotation);
    const rotatedX = worldX * cosR - worldY * sinR;
    const rotatedY = worldX * sinR + worldY * cosR;

    if (isPanning || isRotating) {
        if (isPanning) {
            mapOffsetX += e.clientX - lastMouseX;
            mapOffsetY += e.clientY - lastMouseY;
        } else if (isRotating) {
            mapRotation += (e.clientX - lastMouseX) / 300; // Adjust rotation speed
        }
    } else {
        // Hover logic
        let isAnyObjectHovered = false;
        // Iterate backwards to check top-most items first
        for (let i = mapObjects.length - 1; i >= 0; i--) {
            const obj = mapObjects[i];
            if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number' || typeof obj.width !== 'number' || typeof obj.height !== 'number' || typeof obj.scale !== 'number') continue;
            
            const displayWidth = obj.width * obj.scale;
            const displayHeight = obj.height * obj.scale;
            const halfWidth = displayWidth / 2;
            const halfHeight = displayHeight / 2;

            const isHovered = (rotatedX >= obj.x - halfWidth && rotatedX <= obj.x + halfWidth && rotatedY >= obj.y - halfHeight && rotatedY <= obj.y + halfHeight);
            
            obj.isFrozen = isHovered; // Freeze rotation on hover

            if (isHovered && (obj.address || ['daodao', 'bbl', 'boost', 'enterprise'].includes(obj.id))) {
                isAnyObjectHovered = true;
                break; // Stop checking once we find a clickable hover
            }
        }
        if(spaceCanvas) spaceCanvas.style.cursor = isAnyObjectHovered ? 'pointer' : 'grab';
    }
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
};
const handleMapWheel = (e) => {
    e.preventDefault();
    if (!spaceCanvas) return;
    const rect = spaceCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = 1.1;
    const minZoom = 0.1, maxZoom = 5;
    
    const currentZoom = (mapZoom === 0) ? 0.0001 : mapZoom;
    
    // Mouse position in world space before zoom
    const mouseBeforeZoomX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / currentZoom;
    const mouseBeforeZoomY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / currentZoom;

    let newZoom;
    if (e.deltaY < 0) { // Zoom in
        newZoom = Math.min(maxZoom, currentZoom * zoomFactor);
    } else { // Zoom out
        newZoom = Math.max(minZoom, currentZoom / zoomFactor);
    }
    if (newZoom <= 0) newZoom = minZoom; // Prevent zero or negative zoom

    // Mouse position in world space after zoom
    const mouseAfterZoomX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / newZoom;
    const mouseAfterZoomY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / newZoom;

    // Adjust offset to keep mouse position stable
    mapOffsetX += (mouseAfterZoomX - mouseBeforeZoomX) * newZoom;
    mapOffsetY += (mouseAfterZoomY - mouseBeforeZoomY) * newZoom;
    mapZoom = newZoom;
};
const handleMapClick = (e) => {
    if (!spaceCanvas) return;
    const rect = spaceCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentZoom = (mapZoom === 0) ? 0.0001 : mapZoom;
    const worldX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / currentZoom;
    const worldY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / currentZoom;
    const sinR = Math.sin(-mapRotation);
    const cosR = Math.cos(-mapRotation);
    const rotatedX = worldX * cosR - worldY * sinR;
    const rotatedY = worldX * sinR + worldY * cosR;

    let clickedObject = null;
    // Check in reverse to prioritize clicking top-most items (ships)
    for (let i = mapObjects.length - 1; i >= 0; i--) {
        const obj = mapObjects[i];
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
        console.log("Map click on object:", clickedObject);
        if (clickedObject.address) {
            showWalletExplorerModal(clickedObject.address);
        } else if (['daodao', 'bbl', 'boost', 'enterprise'].includes(clickedObject.id)) {
             showSystemLeaderboardModal(clickedObject.id);
        }
    } else {
        console.log("Map click on empty space.");
    }
};
const handleMapResize = debounce(() => {
    console.log("Resize detected, re-initializing map.");
    isMapInitialized = false; // Force re-init
    mapOffsetX = 0; // Reset pan
    mapOffsetY = 0;
    if (mapView && !mapView.classList.contains('hidden')) {
        initializeStarfield(); // Only re-init if map is visible
    }
}, 250);

let mapListenersAdded = false;
function addMapListeners() {
    if (mapListenersAdded || !spaceCanvas) return;
    console.log("Adding map listeners");
    spaceCanvas.addEventListener('contextmenu', handleMapContextMenu);
    spaceCanvas.addEventListener('mousedown', handleMapMouseDown);
    window.addEventListener('mouseup', handleMapMouseUp); // Listen on window for mouseup
    spaceCanvas.addEventListener('mouseleave', handleMapMouseLeave);
    spaceCanvas.addEventListener('mousemove', handleMapMouseMove);
    spaceCanvas.addEventListener('wheel', handleMapWheel, { passive: false });
    spaceCanvas.addEventListener('click', handleMapClick);
    mapListenersAdded = true;
}

const initializeStarfield = () => {
    if (!spaceCanvas) { console.error("Canvas not found!"); return; }
    
    if (isMapInitialized && globalAnimationFrameId) {
        console.log("Map already running.");
        return; // Already initialized and running
    }
    
    if (isMapInitialized && !globalAnimationFrameId) {
        console.log("Restarting map animation frame.");
        animate(); // Was initialized but stopped, restart animation
        return;
    }
    
    console.log("Initializing starfield...");
    const ctx = spaceCanvas.getContext('2d');
    if (!ctx) { console.error("Could not get 2D context"); return; }
    
    // Reset state
    mapStars = [];
    mapObjects = [];
    mapZoom = 0.15;
    mapRotation = 0;
    mapOffsetX = 0;
    mapOffsetY = 0;
    isPanning = false;
    isRotating = false;
    lastMouseX = 0;
    lastMouseY = 0;
    const minZoom = 0.1, maxZoom = 5;

    function setCanvasSize() {
        // Use clientWidth/Height for responsive sizing
        const dpr = window.devicePixelRatio || 1;
        const rect = spaceCanvas.getBoundingClientRect();
        
        if (spaceCanvas.width !== rect.width * dpr || spaceCanvas.height !== rect.height * dpr) {
            spaceCanvas.width = rect.width * dpr;
            spaceCanvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr); // Scale context for high-DPI
            console.log(`Canvas resized to: ${spaceCanvas.width}x${spaceCanvas.height} (scaled to ${rect.width}x${rect.height})`);
            return true; // Size changed
        }
        return false; // Size was already correct
    }
    
    function createStars() {
        mapStars = [];
        const w = spaceCanvas.clientWidth, h = spaceCanvas.clientHeight;
        if (w === 0 || h === 0) return;
        const starCount = (w * h * 4) / 1000; 
        for (let i = 0; i < starCount; i++) {
            mapStars.push({
                x: (Math.random() - 0.5) * w * 10, // Spread stars wide
                y: (Math.random() - 0.5) * h * 10,
                radius: Math.random() * 1.5 + 0.5,
                alpha: Math.random(),
                twinkleSpeed: Math.random() * 0.03 + 0.005,
                twinkleDirection: 1
            });
        }
    }

    function drawGalaxy() {
        if (!ctx || !spaceCanvas) return;
        
        // Use clientWidth/Height for drawing dimensions
        const w = spaceCanvas.clientWidth;
        const h = spaceCanvas.clientHeight;
        
        ctx.save();
        ctx.clearRect(0, 0, w, h); // Clear based on CSS size
        
        if (w === 0 || h === 0) { ctx.restore(); return; } // Don't draw if hidden

        ctx.translate(w / 2 + mapOffsetX, h / 2 + mapOffsetY);
        ctx.scale(mapZoom, mapZoom);
        ctx.rotate(mapRotation);

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
                        const targetWidth = (typeof target.width === 'number' && target.width > 0) ? target.width : 100;
                        const targetScale = (typeof target.scale === 'number' && target.scale > 0) ? target.scale : 0.1;
                        const edgeRadius = (targetWidth * targetScale / 2) * 0.45; 
                        ctx.lineTo(target.x + Math.cos(angle) * edgeRadius, target.y + Math.sin(angle) * edgeRadius);
                    } else if (obj.id.startsWith('satellite')) {
                        ctx.lineTo(target.x, target.y);
                        const mothership = mapObjects.find(m => m.id === `mothership_${obj.system}_${obj.address}`);
                        if(mothership) ctx.lineTo(mothership.x, mothership.y);
                    } else {
                         ctx.lineTo(target.x, target.y);
                    }
                    ctx.strokeStyle = systemLineColors[obj.system] || 'grey';
                    ctx.lineWidth = 2 / mapZoom;
                    ctx.stroke();
                }
            }
        });

        mapObjects.forEach(obj => {
            if (!obj.img || !obj.img.complete || !(obj.width > 0) || !(obj.height > 0)) return;
            
            let displayWidth = obj.width * obj.scale;
            let displayHeight = obj.height * obj.scale;
            
            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.rotate(obj.rotation || 0);
            try {
                ctx.drawImage(obj.img, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight);
            } catch (e) {
                // console.error("Error drawing map image:", e, obj.id);
            }
            ctx.restore();

            if(obj.textAbove || obj.textBelow) {
                ctx.save();
                ctx.translate(obj.x, obj.y);
                ctx.rotate(-mapRotation); // Counter-rotate text
                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                const textScale = 1 / mapZoom;
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
                star.alpha = Math.max(0, Math.min(1, star.alpha)); // Clamp
                star.twinkleDirection *= -1;
            }
        });
    }
    
    function updateObjectRotations() {
        mapObjects.forEach(obj => {
            if (obj.rotationSpeed && !obj.isFrozen) {
                obj.rotation = (obj.rotation || 0) + obj.rotationSpeed;
            }
        });
    }

    function animate() {
        if (!isMapInitialized || !spaceCanvas || !document.body.contains(spaceCanvas) || mapView.classList.contains('hidden')) {
            if (globalAnimationFrameId) {
                cancelAnimationFrame(globalAnimationFrameId);
                globalAnimationFrameId = null;
                console.log("Stopping map animation.");
            }
            return;
        }
        
        setCanvasSize(); // Check size every frame
        updateStars();
        updateObjectRotations();
        drawGalaxy();
        globalAnimationFrameId = requestAnimationFrame(animate);
    }
    
    function addMapObject(config, preloadedImages) {
        const img = preloadedImages[config.imageId];
        if (!img || !img.width || !img.height) {
            console.error(`Image with ID ${config.imageId} not preloaded or has no dimensions.`);
            return;
        }
        mapObjects.push({ 
            ...config, 
            img: img, 
            width: img.width, 
            height: img.height, 
            isFrozen: false, 
            rotation: config.rotation || 0 
        });
    }

    function initMap() {
        console.log("initMap called");
        if (globalAnimationFrameId) {
            cancelAnimationFrame(globalAnimationFrameId);
            globalAnimationFrameId = null;
        }
        
        if (!spaceCanvas) return;
        setCanvasSize(); // Set size immediately
        if (spaceCanvas.width === 0 || spaceCanvas.height === 0) {
            console.error("Canvas has zero dimensions in initMap. Aborting.");
            return;
        }

        mapObjects = [];
        createStars();
        
        // ***** THIS IS THE CORRECTED BLOCK *****
        const imageAssets = {
            daodao: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/daodao-planet.png',
            bbl: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/bbl-planet.png',
            boost: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/boost-ship.png',
            enterprise: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/enterprise-blackhole.png',
            allianceLogo: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/aDAO%20Logo%20No%20Background.png',
            terra: 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/Terra.PNG'
        };
        // ***************************************

        const imagePromises = Object.entries(imageAssets).map(([id, url]) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve({ id, img });
                img.onerror = (e) => {
                    console.error(`Failed to load image: ${id} from ${url}`, e);
                    reject(new Error(`Failed to load ${id}`));
                };
                // Don't do the replace logic, URL is already raw
                img.src = url;
            });
        });

        Promise.all(imagePromises).then(loadedImageArray => {
            const preloadedImages = loadedImageArray.reduce((acc, {id, img}) => {
                acc[id] = img;
                return acc;
            }, {});
            
            setCanvasSize(); // Set size again in case it changed during load
            if (spaceCanvas.width === 0 || spaceCanvas.height === 0) {
                 console.error("Canvas has zero dimensions after image load. Aborting.");
                 isMapInitialized = false;
                 return;
            }
            
            buildGalaxySystems(preloadedImages);
            isMapInitialized = true;
            console.log("Map initialized, starting animation.");
            animate(); // Start the animation loop

        }).catch(error => {
            console.error("Error loading system images:", error);
            isMapInitialized = false;
        });
    }
    
    function buildGalaxySystems(preloadedImages) {
        const w = spaceCanvas.clientWidth, h = spaceCanvas.clientHeight;
        if (w === 0 || h === 0) {
            console.error("Canvas zero dimensions, cannot build galaxy");
            return;
        }

        const systemCenters = {
            daodao: { x: 0, y: -h * 2 },
            bbl: { x: -w * 2, y: 0 },
            boost: { x: w * 2, y: 0 },
            enterprise: { x: 0, y: h * 2 }
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
        
        // Calculate counts for scaling
        const bblCount = allNfts.filter(n=>n.bbl_market).length;
        const boostCount = allNfts.filter(n=>n.boost_market).length;
        const enterpriseCount = allNfts.filter(n=>n.staked_enterprise_legacy).length;

        addSystemCenter('daodao', 'daodao', 'planet', 0.5, true);
        addSystemCenter('bbl', 'bbl', 'planet', bblCount > 0 ? (bblCount / 59) * 0.5 : 0.1, true); // Use count, default 0.1
        addSystemCenter('boost', 'boost', 'ship_main', boostCount > 0 ? (boostCount / 59) * 0.5 : 0.1, true);
        addSystemCenter('enterprise', 'enterprise', 'blackhole', enterpriseCount > 0 ? (enterpriseCount / 515) * 0.5 : 0.1, true);


        const holderStats = {}; // Use allHolderStats if already calculated
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
            
            const curW = spaceCanvas.clientWidth, curH = spaceCanvas.clientHeight;
            const minRadius = Math.min(curW, curH) * 0.6;
            const maxRadius = Math.min(curW, curH) * 1.5;
            const radiusRange = maxRadius - minRadius;
            const angleStep = (2 * Math.PI) / topHolders.length;

            topHolders.forEach((stats, index) => {
                const { address, total } = stats;
                const platformCount = stats[statKey];
                const angle = angleStep * index;
                
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
            const center = systemCenters.enterprise;
            const statKey = 'enterpriseStaked';
            
             const topStakers = Object.entries(holderStats)
                .filter(([, stats]) => stats[statKey] > 0)
                .sort(([, a], [, b]) => b[statKey] - a[statKey])
                .slice(0, 10)
                .map(([address, stats]) => ({ address, ...stats }));
            
            if (topStakers.length === 0) return;

            const countList = topStakers.map(s => s[statKey]);
            const minCount = Math.min(...countList);
            const maxCount = Math.max(...countList);
            const countRange = maxCount > minCount ? maxCount - minCount : 1;

            const minScale = 0.1; const maxScale = 0.3;
            const scaleRange = maxScale - minScale;
            
            const curW = spaceCanvas.clientWidth, curH = spaceCanvas.clientHeight;
            const minRadius = Math.min(curW, curH) * 0.6;
            const maxRadius = Math.min(curW, curH) * 1.2;
            const radiusRange = maxRadius - minRadius;
            const angleStep = (2 * Math.PI) / topStakers.length;
            
            topStakers.forEach((stats, index) => {
                const { address, enterpriseStaked } = stats;
                const angle = angleStep * index;
                
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
        console.log("Galaxy built.");
    }

    initMap(); // Call the initializer
};

// --- Reusable Address Search Handler ---
const handleAddressInput = (inputEl, suggestionsEl, onSelectCallback, isWallet) => {
    const input = inputEl.value.toLowerCase();
    const reversedInput = input.split('').reverse().join('');
    if (!suggestionsEl) return;
    suggestionsEl.innerHTML = '';

    if (!input) {
        suggestionsEl.classList.add('hidden');
        if (!isWallet && searchAddressInput.value === '' && addressDropdown.value === '') debouncedFilter();
        return;
    }
    
    // Use the master list of all owners for suggestions
    let matches = ownerAddresses.filter(addr => addr.toLowerCase().endsWith(reversedInput));

    const sortIndex = reversedInput.length;
    matches.sort((a, b) => {
        const charA = a.charAt(a.length - 1 - sortIndex) || '';
        const charB = b.charAt(b.length - 1 - sortIndex) || '';
        return charA.localeCompare(charB);
    });

    if (matches.length > 0) {
        matches.slice(0, 10).forEach(match => {
            const item = document.createElement('div');
            item.className = 'address-suggestion-item';
            const startIndex = match.length - reversedInput.length;
            item.innerHTML = `${match.substring(0, startIndex)}<strong class="text-cyan-400">${match.substring(startIndex)}</strong>`;
            item.style.direction = 'ltr';
            item.style.textAlign = 'left';
            item.onclick = () => {
                inputEl.value = match;
                suggestionsEl.classList.add('hidden');
                onSelectCallback();
            };
            suggestionsEl.appendChild(item);
        });
        if (matches.length > 10) {
            const item = document.createElement('div');
            item.className = 'address-suggestion-item text-gray-400';
            item.textContent = `${matches.length - 10} more...`;
            suggestionsEl.appendChild(item);
        }
        suggestionsEl.classList.remove('hidden');
    } else {
        suggestionsEl.classList.add('hidden');
    }
    // Trigger filter *only* for collection view input
    if (!isWallet) debouncedFilter();
};

const showWalletExplorerModal = (address) => {
    const walletNfts = allNfts.filter(nft => nft.owner === address);
    if (walletNfts.length === 0) return;

    const titleEl = document.getElementById('wallet-modal-title');
    const statsEl = document.getElementById('wallet-modal-stats');
    const galleryEl = document.getElementById('wallet-modal-gallery');

    if (!titleEl || !statsEl || !galleryEl) return;

    titleEl.textContent = address;
    statsEl.innerHTML = '';
    galleryEl.innerHTML = '';

    const daodaoStaked = walletNfts.filter(n => n.staked_daodao).length;
    const enterpriseStaked = walletNfts.filter(n => n.staked_enterprise_legacy).length;
    const boostListed = walletNfts.filter(n => n.boost_market).length;
    const bblListed = walletNfts.filter(n => n.bbl_market).length;
    const broken = walletNfts.filter(n => n.broken).length;
    const total = walletNfts.length;
    const unbroken = total - broken;
    const liquid = walletNfts.filter(n => n.liquid).length; // Recalculate for this specific wallet

    const stats = [
        { label: 'Total NFTs', value: total, color: 'text-white' },
        { label: 'Liquid', value: liquid, color: 'text-white' },
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

    walletNfts.sort((a,b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).forEach(nft => {
        galleryEl.appendChild(createNftCard(nft, '.wallet-trait-toggle'));
    });

    walletExplorerModal.classList.remove('hidden');
};

const hideWalletExplorerModal = () => {
    if (walletExplorerModal) walletExplorerModal.classList.add('hidden');
};

// --- System Leaderboard Modal Logic ---
const showSystemLeaderboardModal = (systemId) => {
     const systemKeyMap = {
        daodao: 'daodaoStaked',
        bbl: 'bblListed',
        boost: 'boostListed',
        enterprise: 'enterpriseStaked'
    };
    const systemNameMap = {
        daodao: 'DAODAO Staking',
        bbl: 'BackBone Labs Listings',
        boost: 'Boost Marketplace Listings',
        enterprise: 'Enterprise Staking'
    };
    const statKey = systemKeyMap[systemId];
    if (!statKey) return;
    
    const leaderboardData = Object.values(allHolderStats)
        .filter(stats => stats[statKey] > 0)
        .sort((a, b) => b[statKey] - a[statKey]);

    const titleEl = document.getElementById('system-modal-title');
    const disclaimerEl = document.getElementById('system-modal-disclaimer');
    if (!titleEl || !disclaimerEl) return;
    
    titleEl.textContent = `${systemNameMap[systemId]} Leaderboard`;

    if (systemId === 'boost') {
        disclaimerEl.innerHTML = `<strong>Note:</strong> Addresses ending in <strong>...f4at</strong> belong to the Boost contract, not the actual NFT owner. We hope Boost updates their platform in the future to allow for individual owner identification.`;
        disclaimerEl.classList.remove('hidden');
    } else {
        disclaimerEl.classList.add('hidden');
    }
    
    displaySystemLeaderboardPage(leaderboardData, statKey, 1);
    systemLeaderboardModal.classList.remove('hidden');
};

const displaySystemLeaderboardPage = (data, statKey, page) => {
    const tableEl = document.getElementById('system-modal-table');
    const paginationEl = document.getElementById('system-modal-pagination');
    if (!tableEl || !paginationEl) return;
    
    const itemsPerPage = 10;
    tableEl.innerHTML = '';
    paginationEl.innerHTML = '';

    const pageData = data.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    let tableHtml = `<div class="leaderboard-header" style="grid-template-columns: 1fr 4fr 1fr;"><span>Rank</span><span class="text-left">Address</span><span class="text-center">Amount</span></div>`;
    pageData.forEach((stats, index) => {
        const rank = (page - 1) * itemsPerPage + index + 1;
        tableHtml += `
            <div class="leaderboard-row" style="grid-template-columns: 1fr 4fr 1fr;">
                <span class="text-center font-bold">#${rank}</span>
                <span class="font-mono text-sm truncate" title="${stats.address}">${stats.address}</span>
                <span class="text-center font-bold">${stats[statKey] || 0}</span>
            </div>
        `;
    });
    tableEl.innerHTML = tableHtml;

    const totalPages = Math.ceil(data.length / itemsPerPage);
    if (totalPages > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Previous';
        prevBtn.className = 'pagination-btn';
        prevBtn.disabled = page === 1;
        prevBtn.onclick = () => displaySystemLeaderboardPage(data, statKey, page - 1);
        paginationEl.appendChild(prevBtn);

        const pageInfo = document.createElement('span');
        pageInfo.className = 'text-gray-400';
        pageInfo.textContent = `Page ${page} of ${totalPages}`;
        paginationEl.appendChild(pageInfo);
        
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        nextBtn.className = 'pagination-btn';
        nextBtn.disabled = page === totalPages;
        nextBtn.onclick = () => displaySystemLeaderboardPage(data, statKey, page + 1);
        paginationEl.appendChild(nextBtn);
    }
};

const hideSystemLeaderboardModal = () => {
    if (systemLeaderboardModal) systemLeaderboardModal.classList.add('hidden');
};

const searchWallet = () => {
    if (!walletSearchAddressInput || !walletGallery || !walletGalleryTitle) return;
    
    const address = walletSearchAddressInput.value.trim();
    if (walletAddressSuggestions) walletAddressSuggestions.classList.add('hidden');

    document.querySelectorAll('#leaderboard-table .leaderboard-row').forEach(row => {
        row.classList.toggle('selected', row.dataset.address === address);
    });

    if (!address) {
        showError(walletGallery, 'Please enter a wallet address.');
        walletGalleryTitle.textContent = 'Wallet NFTs';
        return;
    }
    const walletNfts = allNfts.filter(nft => nft.owner === address);
    walletGalleryTitle.textContent = `Found ${walletNfts.length} NFTs for wallet:`;
    walletGallery.innerHTML = '';
    if (walletNfts.length === 0) {
        showLoading(walletGallery, 'No NFTs found for this address.');
        return;
    }
    walletNfts.sort((a,b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).forEach(nft => {
        walletGallery.appendChild(createNftCard(nft, '.wallet-trait-toggle'));
    });
};

// --- Hash Handling ---
const handleHashChange = () => {
    console.log("Hash changed:", window.location.hash);
    const hash = window.location.hash.substring(1);
    if (hash && /^\d+$/.test(hash)) {
        const nftId = parseInt(hash, 10);
        if (allNfts.length > 0) {
            const nftToShow = allNfts.find(nft => nft.id === nftId);
            if (nftToShow) {
                console.log("Found NFT from hash:", nftId);
                showNftDetails(nftToShow);
            } else {
                console.log("NFT ID from hash not found:", nftId);
                hideNftDetails(); // Hide modal if ID is not valid
            }
        } else if (!isInitialLoad) {
            // Data is loaded, but hash was checked before it was ready.
            // Now we can hide it if it's not found.
             hideNftDetails();
        }
        // If data isn't loaded yet (isInitialLoad = true), do nothing.
        // initializeExplorer will call this function again.
    } else {
        hideNftDetails(); // Hide modal if hash is empty or invalid
    }
};


// --- Initialize Application ---
// Wait for DOM content to be loaded before running the script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExplorer);
} else {
    initializeExplorer(); // DOM is already ready
}





