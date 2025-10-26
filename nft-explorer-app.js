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
const spaceCanvas = document.getElementById('space-canvas');


// --- Config ---
const METADATA_URL = "https://cdn.jsdelivr.net/gh/defipatriot/nft-metadata/all_nfts_metadata.json";
const STATUS_DATA_URL = "https://deving.zone/en/nfts/alliance_daos.json";
const DAO_WALLET_ADDRESS = "terra1sffd4efk2jpdt894r04qwmtjqrrjfc52tmj6vkzjxqhd8qqu2drs3m5vzm";
const DAO_LOCKED_WALLET_SUFFIXES = ["8ywv", "417v", "6ugw"];
const itemsPerPage = 20;
const traitOrder = ["Rank", "Rarity", "Planet", "Inhabitant", "Object", "Weather", "Light"];
const filterLayoutOrder = ["Rarity", "Object", "Weather", "Light"];
const defaultTraitsOn = ["Rank", "Planet", "Inhabitant", "Object"];

// --- State ---
let allNfts = [];
let filteredNfts = []; // The currently displayed NFTs after filters
let currentPage = 1;
let traitCounts = {};
let inhabitantCounts = {};
let planetCounts = {};
let ownerAddresses = []; // Master list of all unique owners (from initial load)
let currentFilteredOwnerAddresses = []; // List of owners currently in filteredNfts
let allHolderStats = [];
let holderCurrentPage = 1;
const holdersPerPage = 10;
let holderSort = { column: 'total', direction: 'desc' };
let globalAnimationFrameId;
let isMapInitialized = false;
let mapZoom = 0.15, mapRotation = 0, mapOffsetX = 0, mapOffsetY = 0;
let isPanning = false, isRotating = false;
let lastMouseX = 0, lastMouseY = 0;
let mapStars = [];
let mapObjects = [];


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
        let mergedNft = { ...nft };

        if (status) {
            mergedNft.owner = status.owner;
            mergedNft.broken = status.broken;
            mergedNft.staked_daodao = status.daodao;
            mergedNft.staked_enterprise_legacy = status.enterprise;
            mergedNft.bbl_market = status.bbl;
            mergedNft.boost_market = status.boost;
            const isStaked = status.daodao || status.enterprise;
            const isListed = status.bbl || status.boost;
            const isOwnedByMainDAO = status.owner === DAO_WALLET_ADDRESS;
            const isOwnedByLockedDAO = status.owner ? DAO_LOCKED_WALLET_SUFFIXES.some(suffix => status.owner.endsWith(suffix)) : false;
            mergedNft.liquid = !isOwnedByMainDAO && !isOwnedByLockedDAO && !isStaked && !isListed;
            mergedNft.owned_by_alliance_dao = isOwnedByMainDAO || isOwnedByLockedDAO;
        } else {
             mergedNft.owner = null;
             mergedNft.broken = false;
             mergedNft.staked_daodao = false;
             mergedNft.staked_enterprise_legacy = false;
             mergedNft.bbl_market = false;
             mergedNft.boost_market = false;
             mergedNft.liquid = true;
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
        const [metaResponse, statusResponse] = await Promise.all([ fetch(METADATA_URL), fetch(STATUS_DATA_URL) ]);
        if (!metaResponse.ok || !statusResponse.ok) throw new Error(`Network response was not ok`);
        const metadata = await metaResponse.json();
        const statusData = await statusResponse.json();
        if (!Array.isArray(metadata) || metadata.length === 0) { showError(gallery, "Metadata invalid."); return; }

        allNfts = mergeNftData(metadata, statusData);
        ownerAddresses = [...new Set(allNfts.map(nft => nft.owner).filter(Boolean))]; // Populate master owner list

        calculateRanks();
        populateTraitFilters();
        populateInhabitantFilters();
        populatePlanetFilters();
        populateStatusFilters();
        populateTraitToggles();
        populateWalletTraitToggles();
        updateAddressFeatures(allNfts); // Initial dropdown population based on ALL NFTs
        updateFilterCounts(allNfts);
        addAllEventListeners();
        applyStateFromUrl();
        applyFiltersAndSort(); // This will re-call updateAddressFeatures with filtered list
        calculateAndDisplayLeaderboard();

    } catch (error) {
        console.error("Failed to initialize explorer:", error);
        showError(gallery, `Could not load data. Error: ${error.message}`);
        showError(leaderboardTable, 'Could not load data.');
        showError(walletGallery, 'Could not load data.');
    }
};

// --- (calculateRanks, UI Population functions remain largely the same) ---
const calculateRanks = () => { /* ... calculates ranks ... */
    traitCounts = {}; inhabitantCounts = {}; planetCounts = {};
    allNfts.forEach(nft => { if (nft.attributes) { nft.attributes.forEach(attr => { /* ... count traits ... */
        if (!traitCounts[attr.trait_type]) traitCounts[attr.trait_type] = {};
        traitCounts[attr.trait_type][attr.value] = (traitCounts[attr.trait_type][attr.value] || 0) + 1;
        if (attr.trait_type === 'Inhabitant') { /* ... count inhabitants ... */
            const baseName = attr.value.replace(/ (M|F)$/, '');
            if (!inhabitantCounts[baseName]) inhabitantCounts[baseName] = { total: 0, male: 0, female: 0 };
            inhabitantCounts[baseName].total++;
            if (attr.value.endsWith(' M')) inhabitantCounts[baseName].male++; else if (attr.value.endsWith(' F')) inhabitantCounts[baseName].female++;
         }
        if (attr.trait_type === 'Planet') { /* ... count planets ... */
            const baseName = attr.value.replace(/ (North|South)$/, '');
            if (!planetCounts[baseName]) planetCounts[baseName] = { total: 0, north: 0, south: 0 };
            planetCounts[baseName].total++;
            if (attr.value.endsWith(' North')) planetCounts[baseName].north++; else if (attr.value.endsWith(' South')) planetCounts[baseName].south++;
        }
     }); } });
    allNfts.forEach(nft => { /* ... calculate rarity score ... */
        let totalScore = 0;
        if (nft.attributes) { nft.attributes.forEach(attr => { if (traitCounts[attr.trait_type]?.[attr.value] && attr.trait_type !== 'Weather' && attr.trait_type !== 'Light') { const count = traitCounts[attr.trait_type][attr.value]; const rarity = count / allNfts.length; if (rarity > 0) totalScore += 1 / rarity; } }); }
        nft.rarityScore = totalScore;
     });
    allNfts.sort((a, b) => b.rarityScore - a.rarityScore); allNfts.forEach((nft, index) => { nft.rank = index + 1; });
};
const createFilterItem = (config) => { /* ... creates toggle + slider item ... */
    const container = document.createElement('div'); container.className = 'flex items-center justify-between';
    const toggleLabel = document.createElement('label'); toggleLabel.className = 'toggle-label'; toggleLabel.innerHTML = `<input type="checkbox" class="toggle-checkbox ${config.toggleClass}" data-key="${config.key}"><span class="toggle-switch mr-2"></span><span class="font-medium">${config.label}</span>`;
    const sliderContainer = document.createElement('div'); sliderContainer.className = 'flex flex-col items-center'; sliderContainer.innerHTML = `<span class="text-xs text-gray-400 h-4 ${config.countClass || ''}" data-count-key="${config.key}">${config.initialCount || '0'}</span><div class="direction-slider-container"><span class="text-xs text-gray-400">${config.left}</span><input type="range" min="0" max="2" value="1" class="direction-slider ${config.sliderClass}" data-slider-key="${config.key}" disabled><span class="text-xs text-gray-400">${config.right}</span></div>`;
    container.appendChild(toggleLabel); container.appendChild(sliderContainer); return container;
};
const populateInhabitantFilters = () => { /* ... populates inhabitant filters ... */
    inhabitantFiltersContainer.innerHTML = ''; const uniqueInhabitants = Object.keys(inhabitantCounts).sort();
    uniqueInhabitants.forEach(name => { const container = createFilterItem({ toggleClass: 'inhabitant-toggle-cb', key: name, label: name, countClass: 'inhabitant-count', initialCount: inhabitantCounts[name]?.total || 0, sliderClass: 'gender-slider', left: 'M', right: 'F' }); inhabitantFiltersContainer.appendChild(container); container.addEventListener('mouseenter', (e) => showPreviewTile(e, 'Inhabitant', name)); container.addEventListener('mouseleave', hidePreviewTile); });
};
const populatePlanetFilters = () => { /* ... populates planet filters ... */
    planetFiltersContainer.innerHTML = ''; const planetNames = Object.keys(planetCounts).sort();
    planetNames.forEach(name => { const container = createFilterItem({ toggleClass: 'planet-toggle-cb', key: name, label: name, countClass: 'planet-count', initialCount: planetCounts[name]?.total || 0, sliderClass: 'planet-slider', left: 'N', right: 'S' }); planetFiltersContainer.appendChild(container); container.addEventListener('mouseenter', (e) => showPreviewTile(e, 'Planet', name)); container.addEventListener('mouseleave', hidePreviewTile); });
};
const populateTraitFilters = () => { /* ... populates multi-select trait filters ... */
    traitFiltersContainer.innerHTML = '';
    const createMultiSelect = (traitType, values) => { /* ... creates dropdown ... */
        const container = document.createElement('div'); container.className = 'multi-select-container'; let optionsHtml = ''; values.forEach(value => { const style = value === 'Phoenix Rising' ? 'style="color: #f97316; font-weight: bold;"' : ''; optionsHtml += `<label ${style}><input type="checkbox" class="multi-select-checkbox" data-trait="${traitType}" value="${value}"> <span class="trait-value">${value}</span> (<span class="trait-count">0</span>)</label>`; }); container.innerHTML = `<label class="block text-sm font-medium text-gray-300 mb-1">${traitType}</label><button type="button" class="multi-select-button"><span>All ${traitType}s</span><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></button><div class="multi-select-dropdown hidden">${optionsHtml}</div>`; const button = container.querySelector('.multi-select-button'); const dropdown = container.querySelector('.multi-select-dropdown'); button.addEventListener('click', (e) => { e.stopPropagation(); closeAllDropdowns(dropdown); dropdown.classList.toggle('hidden'); }); dropdown.addEventListener('change', () => { updateMultiSelectButtonText(container); handleFilterChange(); }); if (traitType === 'Object') { dropdown.querySelectorAll('label').forEach(label => { const checkbox = label.querySelector('input'); if (checkbox) { label.addEventListener('mouseenter', (e) => showPreviewTile(e, 'Object', checkbox.value)); label.addEventListener('mouseleave', hidePreviewTile); } }); } return container;
     };
    filterLayoutOrder.forEach(traitType => { let values = Object.keys(traitCounts[traitType] || {}).sort(); if (traitType === 'Rarity') values.sort((a, b) => Number(b) - Number(a)); else if (['Object', 'Weather', 'Light'].includes(traitType)) values.sort((a, b) => (traitCounts[traitType]?.[a] || 0) - (traitCounts[traitType]?.[b] || 0)); if (traitType === 'Object') { const idx = values.indexOf('Phoenix Rising'); if (idx > -1) { const [phx] = values.splice(idx, 1); values.unshift(phx); } } traitFiltersContainer.appendChild(createMultiSelect(traitType, values)); });
};
const populateStatusFilters = () => { /* ... populates status filters ... */
    statusFiltersGrid.innerHTML = ''; const statusConfig = [ { key: 'staked', label: 'Staked', left: 'Enterprise', right: 'DAODAO' }, { key: 'listed', label: 'Listed', left: 'Boost', right: 'BackBoneLabs' }, { key: 'rewards', label: 'Rewards', left: 'Broken', right: 'Unbroken' } ]; statusConfig.forEach(filter => { const container = createFilterItem({...filter, toggleClass: 'status-toggle-cb', countClass: 'status-count', sliderClass: 'status-slider'}); statusFiltersGrid.appendChild(container); }); mintStatusContainer.innerHTML = ''; const mintFilter = createFilterItem({ toggleClass: 'status-toggle-cb', key: 'mint_status', label: 'Mint Status', countClass: 'status-count', sliderClass: 'status-slider', left: 'Un-Minted', right: 'Minted' }); mintStatusContainer.appendChild(mintFilter); if (mintStatusContainer.parentElement) { const liquidFilter = createFilterItem({ toggleClass: 'status-toggle-cb', key: 'liquid_status', label: 'Liquid Status', countClass: 'status-count', sliderClass: 'status-slider', left: 'Liquid', right: 'Not Liquid' }); const parentGrid = mintStatusContainer.closest('.grid') || mintStatusContainer.parentElement; parentGrid.appendChild(liquidFilter); }
};
const populateTraitToggles = () => { /* ... populates display trait toggles ... */
    traitTogglesContainer.innerHTML = ''; traitOrder.forEach(traitType => { const label = document.createElement('label'); label.className = 'toggle-label'; label.innerHTML = `<input type="checkbox" class="toggle-checkbox trait-toggle" data-trait="${traitType}" ${defaultTraitsOn.includes(traitType) ? 'checked' : ''}><span class="toggle-switch mr-2"></span><span>${traitType}</span>`; traitTogglesContainer.appendChild(label); });
};
const populateWalletTraitToggles = () => { /* ... populates wallet trait toggles ... */
    walletTraitTogglesContainer.innerHTML = ''; const walletTraits = ["Rank", "Planet", "Inhabitant", "Object"]; walletTraits.forEach(traitType => { const label = document.createElement('label'); label.className = 'toggle-label'; label.innerHTML = `<input type="checkbox" class="toggle-checkbox wallet-trait-toggle" data-trait="${traitType}" checked><span class="toggle-switch mr-2"></span><span>${traitType}</span>`; walletTraitTogglesContainer.appendChild(label); });
};


// --- Event Listeners Setup ---
// ... (map handlers, addAllEventListeners, switchView remain the same) ...
const handleMapContextMenu = (e) => e.preventDefault();
const handleMapMouseDown = (e) => { e.preventDefault(); if (e.button === 1 || e.ctrlKey || e.metaKey) { isRotating = true; isPanning = false; spaceCanvas.style.cursor = 'ew-resize'; } else if (e.button === 0) { isPanning = true; isRotating = false; spaceCanvas.style.cursor = 'grabbing'; } lastMouseX = e.clientX; lastMouseY = e.clientY; };
const handleMapMouseUp = (e) => { e.preventDefault(); isPanning = false; isRotating = false; if (spaceCanvas) spaceCanvas.style.cursor = 'grab'; };
const handleMapMouseLeave = () => { if (isPanning || isRotating) { isPanning = false; isRotating = false; if (spaceCanvas) spaceCanvas.style.cursor = 'grab'; } };
const handleMapMouseMove = (e) => { if (!spaceCanvas) return; const rect = spaceCanvas.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return; const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; if (mouseX < 0 || mouseX > spaceCanvas.width || mouseY < 0 || mouseY > spaceCanvas.height) { if (isPanning || isRotating) { isPanning = false; isRotating = false; spaceCanvas.style.cursor = 'grab'; } return; } const currentZoom = (mapZoom === 0) ? 0.0001 : mapZoom; const worldX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / currentZoom; const worldY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / currentZoom; const sinR = Math.sin(-mapRotation); const cosR = Math.cos(-mapRotation); const rotatedX = worldX * cosR - worldY * sinR; const rotatedY = worldX * sinR + worldY * cosR; if (isPanning || isRotating) { if (isPanning) { mapOffsetX += e.clientX - lastMouseX; mapOffsetY += e.clientY - lastMouseY; } else if (isRotating) { mapRotation += (e.clientX - lastMouseX) / 300; } } else { let isAnyObjectHovered = false; for (let i = mapObjects.length - 1; i >= 0; i--) { const obj = mapObjects[i]; if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number' || typeof obj.width !== 'number' || typeof obj.height !== 'number' || typeof obj.scale !== 'number') continue; const displayWidth = obj.width * obj.scale; const displayHeight = obj.height * obj.scale; const halfWidth = displayWidth / 2; const halfHeight = displayHeight / 2; const isHovered = (rotatedX >= obj.x - halfWidth && rotatedX <= obj.x + halfWidth && rotatedY >= obj.y - halfHeight && rotatedY <= obj.y + halfHeight); obj.isFrozen = isHovered; if (isHovered && (obj.address || ['daodao', 'bbl', 'boost', 'enterprise'].includes(obj.id))) { isAnyObjectHovered = true; break; } } if (spaceCanvas) spaceCanvas.style.cursor = isAnyObjectHovered ? 'pointer' : 'grab'; } lastMouseX = e.clientX; lastMouseY = e.clientY; };
const handleMapWheel = (e) => { e.preventDefault(); if (!spaceCanvas) return; const rect = spaceCanvas.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return; const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const zoomFactor = 1.1; const minZoom = 0.1, maxZoom = 5; const currentZoom = (mapZoom === 0) ? 0.0001 : mapZoom; const mouseBeforeZoomX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / currentZoom; const mouseBeforeZoomY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / currentZoom; let newZoom; if (e.deltaY < 0) newZoom = Math.min(maxZoom, currentZoom * zoomFactor); else newZoom = Math.max(minZoom, currentZoom / zoomFactor); if (newZoom <= 0) newZoom = minZoom; const mouseAfterZoomX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / newZoom; const mouseAfterZoomY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / newZoom; mapOffsetX += (mouseAfterZoomX - mouseBeforeZoomX) * newZoom; mapOffsetY += (mouseAfterZoomY - mouseBeforeZoomY) * newZoom; mapZoom = newZoom; };
 const handleMapClick = (e) => { if (!spaceCanvas) return; const rect = spaceCanvas.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return; const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const currentZoom = (mapZoom === 0) ? 0.0001 : mapZoom; const worldX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / currentZoom; const worldY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / currentZoom; const sinR = Math.sin(-mapRotation); const cosR = Math.cos(-mapRotation); const rotatedX = worldX * cosR - worldY * sinR; const rotatedY = worldX * sinR + worldY * cosR; let clickedObject = null; for (let i = mapObjects.length - 1; i >= 0; i--) { const obj = mapObjects[i]; if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number' || typeof obj.width !== 'number' || typeof obj.height !== 'number' || typeof obj.scale !== 'number') continue; const displayWidth = obj.width * obj.scale; const displayHeight = obj.height * obj.scale; const halfWidth = displayWidth / 2; const halfHeight = displayHeight / 2; if (rotatedX >= obj.x - halfWidth && rotatedX <= obj.x + halfWidth && rotatedY >= obj.y - halfHeight && rotatedY <= obj.y + halfHeight) { clickedObject = obj; break; } } if (clickedObject) { console.log("Clicked map object:", clickedObject); if (clickedObject.address) showWalletExplorerModal(clickedObject.address); else if (['daodao', 'bbl', 'boost', 'enterprise'].includes(clickedObject.id)) showSystemLeaderboardModal(clickedObject.id); } else console.log("Clicked empty space."); };
const handleMapResize = debounce(() => { console.log("Window resize, re-init map."); isMapInitialized = false; mapOffsetX = 0; mapOffsetY = 0; initializeStarfield(); }, 250);

const addAllEventListeners = () => { /* ... adds all event listeners ... */
    document.querySelectorAll('.toggle-checkbox').forEach(toggle => toggle.addEventListener('change', (e) => { const parent = e.target.closest('.justify-between'); if (!parent) return; const slider = parent.querySelector('.direction-slider'); if (slider) slider.disabled = !e.target.checked; handleFilterChange(); }));
    document.querySelectorAll('.direction-slider').forEach(slider => slider.addEventListener('input', handleFilterChange));
    document.querySelectorAll('.trait-toggle').forEach(el => el.addEventListener('change', () => displayPage(currentPage)));
    document.querySelectorAll('.multi-select-checkbox').forEach(el => el.addEventListener('change', handleFilterChange)); // Already setup, maybe redundant?
    addressDropdown.addEventListener('change', () => { searchAddressInput.value = addressDropdown.value; handleFilterChange(); });
    walletTraitTogglesContainer.addEventListener('change', (e) => { if (e.target.classList.contains('wallet-trait-toggle')) searchWallet(); });
    document.addEventListener('click', () => closeAllDropdowns());
    modalCloseBtn.addEventListener('click', hideNftDetails); nftModal.addEventListener('click', (e) => { if (e.target === nftModal) hideNftDetails(); });
    rarityExplainedBtn.addEventListener('click', () => rarityModal.classList.remove('hidden')); rarityModalCloseBtn.addEventListener('click', () => rarityModal.classList.add('hidden')); rarityModal.addEventListener('click', (e) => { if (e.target === rarityModal) rarityModal.classList.add('hidden'); });
    badgesExplainedBtn.addEventListener('click', () => badgeModal.classList.remove('hidden')); badgeModalCloseBtn.addEventListener('click', () => badgeModal.classList.add('hidden')); badgeModal.addEventListener('click', (e) => { if (e.target === badgeModal) badgeModal.classList.add('hidden'); });
    walletModalCloseBtn.addEventListener('click', hideWalletExplorerModal); walletExplorerModal.addEventListener('click', (e) => { if (e.target === walletExplorerModal) hideWalletExplorerModal(); });
    systemModalCloseBtn.addEventListener('click', hideSystemLeaderboardModal); systemLeaderboardModal.addEventListener('click', (e) => { if (e.target === systemLeaderboardModal) hideSystemLeaderboardModal(); });
    const debouncedFilterLocal = debounce(handleFilterChange, 300); searchInput.addEventListener('input', debouncedFilterLocal); sortSelect.addEventListener('change', handleFilterChange); resetButton.addEventListener('click', resetAll);
    collectionViewBtn.addEventListener('click', () => switchView('collection')); walletViewBtn.addEventListener('click', () => switchView('wallet')); mapViewBtn.addEventListener('click', () => switchView('map'));
    walletResetBtn.addEventListener('click', () => { walletSearchAddressInput.value = ''; walletGallery.innerHTML = ''; walletGalleryTitle.textContent = 'Wallet NFTs'; document.querySelectorAll('#leaderboard-table tbody tr.selected').forEach(row => row.classList.remove('selected')); showLoading(walletGallery, 'Search for or select wallet.'); });
    walletSearchAddressInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchWallet(); });
    searchAddressInput.addEventListener('input', () => handleAddressInput(searchAddressInput, addressSuggestions, handleFilterChange, false));
    walletSearchAddressInput.addEventListener('input', () => handleAddressInput(walletSearchAddressInput, walletAddressSuggestions, searchWallet, true));
    leaderboardTable.addEventListener('click', (e) => { const headerCellSpan = e.target.closest('th > span[data-sort-by]'); if (!headerCellSpan) return; const newColumn = headerCellSpan.dataset.sortBy; if (holderSort.column === newColumn) holderSort.direction = holderSort.direction === 'desc' ? 'asc' : 'desc'; else { holderSort.column = newColumn; holderSort.direction = (newColumn === 'address') ? 'asc' : 'desc'; } sortAndDisplayHolders(); });
    const setupCopyButton = (buttonEl, inputEl) => { if (buttonEl && inputEl) buttonEl.addEventListener('click', () => copyToClipboard(inputEl.value)); }; setupCopyButton(copyAddressBtn, searchAddressInput); setupCopyButton(walletCopyAddressBtn, walletSearchAddressInput);
    const toggleInhabitantFiltersBtn = document.getElementById('toggle-inhabitant-filters'); const inhabitantArrow = document.getElementById('inhabitant-arrow'); const togglePlanetFiltersBtn = document.getElementById('toggle-planet-filters'); const planetArrow = document.getElementById('planet-arrow');
    if (toggleInhabitantFiltersBtn && inhabitantFiltersContainer && inhabitantArrow) toggleInhabitantFiltersBtn.addEventListener('click', () => { inhabitantFiltersContainer.classList.toggle('hidden'); inhabitantArrow.classList.toggle('rotate-180'); });
    if (togglePlanetFiltersBtn && planetFiltersContainer && planetArrow) togglePlanetFiltersBtn.addEventListener('click', () => { planetFiltersContainer.classList.toggle('hidden'); planetArrow.classList.toggle('rotate-180'); });
    addMapListeners(); window.addEventListener('resize', handleMapResize);
};
function switchView(viewName) { /* ... handles view switching and map animation stop/start ... */
     console.log("Switching view to:", viewName); if (viewName !== 'map' && globalAnimationFrameId) { console.log("Stopping map animation."); cancelAnimationFrame(globalAnimationFrameId); globalAnimationFrameId = null; isMapInitialized = false; }
     collectionView.classList.add('hidden'); walletView.classList.add('hidden'); mapView.classList.add('hidden'); collectionViewBtn.classList.remove('active'); walletViewBtn.classList.remove('active'); mapViewBtn.classList.remove('active');
     if (viewName === 'collection') { collectionView.classList.remove('hidden'); collectionViewBtn.classList.add('active'); }
     else if (viewName === 'wallet') { walletView.classList.remove('hidden'); walletViewBtn.classList.add('active'); }
     else if (viewName === 'map') { mapView.classList.remove('hidden'); mapViewBtn.classList.add('active'); requestAnimationFrame(() => initializeStarfield()); }
 }


// *** NEW/MODIFIED FUNCTION ***
// Updates the address dropdown and suggestion list based on provided NFTs
const updateAddressFeatures = (nftList) => {
    const ownerCounts = {};
    nftList.forEach(nft => {
        if (nft.owner) {
            ownerCounts[nft.owner] = (ownerCounts[nft.owner] || 0) + 1;
        }
    });

    const sortedOwners = Object.entries(ownerCounts)
        .sort(([, countA], [, countB]) => countB - countA); // Sort by count desc

    // Update the state variable for live suggestions
    currentFilteredOwnerAddresses = sortedOwners.map(([address]) => address);

    // Update Dropdown
    const currentSelectedAddress = addressDropdown.value; // Store current selection
    addressDropdown.innerHTML = '<option value="">Holders</option>'; // Clear existing options
    let newSelectionFound = false;
    sortedOwners.forEach(([address, count]) => {
        const option = document.createElement('option');
        option.value = address;
        // Display count + truncated address
        option.textContent = `(${count}) ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        addressDropdown.appendChild(option);
        if (address === currentSelectedAddress) {
            option.selected = true; // Re-select if still present
            newSelectionFound = true;
        }
    });

    // If the previously selected address is no longer in the filtered list,
    // ensure the input field is also cleared ONLY IF it matched the dropdown value.
    if (!newSelectionFound && searchAddressInput.value === currentSelectedAddress) {
         // Don't clear if user was typing a partial address for live search
         // Only clear if the input exactly matched the (now invalid) dropdown selection
         // searchAddressInput.value = ''; // Optional: Clear input if selection vanishes? Might be disruptive.
         addressDropdown.value = ''; // Set dropdown back to default "Holders"
    }
     // If an address is selected via dropdown, ensure the input reflects it (unless user is typing)
     // This seems redundant with the addressDropdown.onchange listener, perhaps remove?
     // else if (newSelectionFound && searchAddressInput.value !== currentSelectedAddress) {
     //      // If dropdown is set, sync input (might overwrite user typing though)
     //      searchAddressInput.value = currentSelectedAddress;
     // }
};


// --- Collection View Logic ---
const applyFiltersAndSort = () => {
    let tempNfts = [...allNfts]; // Start fresh with all NFTs each time

    // --- Apply ALL filters ---
    const addressSearchTerm = searchAddressInput.value.trim().toLowerCase();
    // Address filter applied AFTER other filters if selected via dropdown, otherwise applied FIRST if typed
    // Let's refine this: Apply typed address search first, dropdown later? No, apply all standard filters first.

    // Apply Status Filters
    if (document.querySelector('.status-toggle-cb[data-key="staked"]')?.checked) { /* ... filter staked ... */
        const slider = document.querySelector('.direction-slider[data-slider-key="staked"]');
        if (slider) { const v = slider.value; if (v === '0') tempNfts = tempNfts.filter(n => n.staked_enterprise_legacy); else if (v === '1') tempNfts = tempNfts.filter(n => n.staked_enterprise_legacy || n.staked_daodao); else if (v === '2') tempNfts = tempNfts.filter(n => n.staked_daodao); }
     }
    if (document.querySelector('.status-toggle-cb[data-key="listed"]')?.checked) { /* ... filter listed ... */
        const slider = document.querySelector('.direction-slider[data-slider-key="listed"]');
        if (slider) { const v = slider.value; if (v === '0') tempNfts = tempNfts.filter(n => n.boost_market); else if (v === '1') tempNfts = tempNfts.filter(n => n.boost_market || n.bbl_market); else if (v === '2') tempNfts = tempNfts.filter(n => n.bbl_market); }
     }
    if (document.querySelector('.status-toggle-cb[data-key="rewards"]')?.checked) { /* ... filter rewards ... */
        const slider = document.querySelector('.direction-slider[data-slider-key="rewards"]');
        if (slider) { const v = slider.value; if (v === '0') tempNfts = tempNfts.filter(n => n.broken === true); else if (v === '1') tempNfts = tempNfts.filter(n => n.broken !== undefined); else if (v === '2') tempNfts = tempNfts.filter(n => n.broken === false); }
     }
    if (document.querySelector('.status-toggle-cb[data-key="liquid_status"]')?.checked) { /* ... filter liquid ... */
        const slider = document.querySelector('.direction-slider[data-slider-key="liquid_status"]');
        if (slider) { const v = slider.value; if (v === '0') tempNfts = tempNfts.filter(n => n.liquid === true); else if (v === '2') tempNfts = tempNfts.filter(n => n.liquid === false); } // v=1 does nothing
     }
    if (document.querySelector('.status-toggle-cb[data-key="mint_status"]')?.checked) { /* ... filter mint status ... */
        const slider = document.querySelector('.direction-slider[data-slider-key="mint_status"]');
        if (slider) { const v = slider.value; if (v === '0') tempNfts = tempNfts.filter(n => n.owner === DAO_WALLET_ADDRESS); else if (v === '2') tempNfts = tempNfts.filter(n => n.owner !== DAO_WALLET_ADDRESS); } // v=1 does nothing
     }


    // Apply Planet Filters
    const activePlanetFilters = []; /* ... build activePlanetFilters ... */
    document.querySelectorAll('.planet-toggle-cb:checked').forEach(cb => { const name = cb.dataset.key; const slider = document.querySelector(`.direction-slider[data-slider-key="${name}"]`); if (slider) activePlanetFilters.push({ name: name, direction: slider.value }); });
    if (activePlanetFilters.length > 0) { /* ... filter planets ... */
        tempNfts = tempNfts.filter(nft => { const attr = nft.attributes?.find(a => a.trait_type === 'Planet'); if (!attr) return false; return activePlanetFilters.some(f => { const v = attr.value; if (f.direction === '1') return v.startsWith(f.name); if (f.direction === '0') return v === `${f.name} North`; if (f.direction === '2') return v === `${f.name} South`; return false; }); });
     }

    // Apply Inhabitant Filters
    const activeInhabitantFilters = []; /* ... build activeInhabitantFilters ... */
    document.querySelectorAll('.inhabitant-toggle-cb:checked').forEach(cb => { const name = cb.dataset.key; const slider = document.querySelector(`.gender-slider[data-slider-key="${name}"]`); if (slider) activeInhabitantFilters.push({ name: name, gender: slider.value }); });
    if (activeInhabitantFilters.length > 0) { /* ... filter inhabitants ... */
        tempNfts = tempNfts.filter(nft => { const attr = nft.attributes?.find(a => a.trait_type === 'Inhabitant'); if (!attr) return false; return activeInhabitantFilters.some(f => { if (!attr.value.startsWith(f.name)) return false; if (f.gender === '1') return true; if (f.gender === '0') return attr.value.endsWith(' M'); if (f.gender === '2') return attr.value.endsWith(' F'); return false; }); });
     }

    // Apply Multi-Select Trait Filters
    document.querySelectorAll('.multi-select-container').forEach(container => { /* ... filter traits ... */
        const traitEl = container.querySelector('[data-trait]'); if (!traitEl) return; const trait = traitEl.dataset.trait; let selected = []; container.querySelectorAll('.multi-select-checkbox:checked').forEach(cb => selected.push(cb.value)); if (selected.length === 0) return; tempNfts = tempNfts.filter(nft => nft.attributes?.some(attr => attr.trait_type === trait && selected.includes(attr.value?.toString())));
     });

    // Apply ID Search
    const searchTerm = searchInput.value;
    if (searchTerm) {
        tempNfts = tempNfts.filter(nft => nft.id?.toString() === searchTerm);
    }

    // !! Apply Address Search/Filter AFTER other filters !!
    if (addressSearchTerm) {
         // This re-filters the already filtered 'tempNfts' list by address
        tempNfts = tempNfts.filter(nft =>
            nft.owner &&
            (nft.owner.toLowerCase() === addressSearchTerm ||
            (addressSearchTerm.length < 42 && nft.owner.toLowerCase().endsWith(addressSearchTerm)))
        );
    }


    // --- Update UI based on the filtered list 'tempNfts' ---

    filteredNfts = tempNfts; // Update the global state
    resultsCount.textContent = filteredNfts.length;

    // ** Update address features based on the FINAL filtered list **
    updateAddressFeatures(filteredNfts);

    updateFilterCounts(filteredNfts); // Update counts in filter sections

    // Apply Sorting LAST
    const sortValue = sortSelect.value;
    if (sortValue === 'asc') filteredNfts.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
    else if (sortValue === 'desc') filteredNfts.sort((a, b) => (b.rank ?? -Infinity) - (a.rank ?? -Infinity));
    else if (sortValue === 'id') filteredNfts.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    displayPage(1); // Display the first page of the final, sorted list
};


// ... (handleFilterChange, updateUrlState, applyStateFromUrl remain the same) ...
const handleFilterChange = () => { applyFiltersAndSort(); updateUrlState(); };
const updateUrlState = () => { /* ... updates URL params ... */
     const params = new URLSearchParams(); if (searchAddressInput.value) params.set('address', searchAddressInput.value); if (searchInput.value) params.set('id', searchInput.value); if (sortSelect.value !== 'asc') params.set('sort', sortSelect.value);
     document.querySelectorAll('.multi-select-container').forEach(container => { /* ... add multi-select params ... */ const el = container.querySelector('[data-trait]'); if (!el) return; const t = el.dataset.trait; let sel = []; container.querySelectorAll('.multi-select-checkbox:checked').forEach(cb => sel.push(cb.value)); if (sel.length > 0) params.set(t.toLowerCase(), sel.join(',')); });
     document.querySelectorAll('.toggle-checkbox:checked').forEach(toggle => { /* ... add toggle/slider params ... */ if (toggle.classList.contains('status-toggle-cb') || toggle.classList.contains('planet-toggle-cb') || toggle.classList.contains('inhabitant-toggle-cb')) { params.set(toggle.dataset.key, 'true'); const slider = document.querySelector(`.direction-slider[data-slider-key="${toggle.dataset.key}"]`); if(slider && !slider.disabled) params.set(`${toggle.dataset.key}_pos`, slider.value); } });
     try { const newUrl = `${window.location.pathname}?${params.toString()}`; history.replaceState({}, '', newUrl); } catch (e) { console.warn("Could not update URL state.", e); }
};
const applyStateFromUrl = () => { /* ... reads URL params and sets filter controls ... */
    const params = new URLSearchParams(window.location.search); searchInput.value = params.get('id') || ''; searchAddressInput.value = params.get('address') || ''; const sortParam = params.get('sort'); sortSelect.value = [...sortSelect.options].some(opt => opt.value === sortParam) ? sortParam : 'asc';
    document.querySelectorAll('.multi-select-container').forEach(container => { /* ... set multi-select checks ... */ const el = container.querySelector('[data-trait]'); if (!el) return; const t = el.dataset.trait.toLowerCase(); if (!params.has(t)) return; const vals = params.get(t).split(','); container.querySelectorAll('.multi-select-checkbox').forEach(cb => { cb.checked = vals.includes(cb.value); }); updateMultiSelectButtonText(container); });
    document.querySelectorAll('.toggle-checkbox').forEach(toggle => { /* ... set toggle/slider states ... */ if (toggle.classList.contains('status-toggle-cb') || toggle.classList.contains('planet-toggle-cb') || toggle.classList.contains('inhabitant-toggle-cb')) { const key = toggle.dataset.key; const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`); if (params.get(key) === 'true') { toggle.checked = true; if(slider) { slider.disabled = false; slider.value = params.get(`${key}_pos`) || '1'; } } else { toggle.checked = false; if (slider) slider.disabled = true; } } });
};


const updateMultiSelectButtonText = (container) => { /* ... updates button text for multi-select ... */
    const btnSpan = container.querySelector('.multi-select-button span'); const cb = container.querySelector('.multi-select-checkbox'); if (!btnSpan || !cb) return; const trait = cb.dataset.trait; const checked = container.querySelectorAll('.multi-select-checkbox:checked').length; const total = container.querySelectorAll('.multi-select-checkbox').length; if (checked === 0 || checked === total) btnSpan.textContent = `All ${trait}s`; else btnSpan.textContent = `${checked} ${trait}(s) selected`;
};
const closeAllDropdowns = (exceptThisOne = null) => { /* ... closes dropdowns ... */
    document.querySelectorAll('.multi-select-dropdown').forEach(d => { if (d !== exceptThisOne) d.classList.add('hidden'); }); if (addressSuggestions) addressSuggestions.classList.add('hidden'); if (walletAddressSuggestions) walletAddressSuggestions.classList.add('hidden');
};
const displayPage = (page) => { /* ... displays NFTs for the current page ... */
    currentPage = page; gallery.innerHTML = ''; if (filteredNfts.length === 0) { showLoading(gallery, 'No NFTs match filters.'); updatePaginationControls(0); return; } const totalPages = Math.ceil(filteredNfts.length / itemsPerPage); page = Math.max(1, Math.min(page, totalPages)); currentPage = page; const pageItems = filteredNfts.slice((page - 1) * itemsPerPage, page * itemsPerPage); pageItems.forEach(nft => gallery.appendChild(createNftCard(nft, '.trait-toggle'))); updatePaginationControls(totalPages);
};
const createNftCard = (nft, toggleSelector) => { /* ... creates HTML for an NFT card ... */
    const card = document.createElement('div'); card.className = 'nft-card bg-gray-800 border border-gray-700 rounded-xl overflow-hidden flex flex-col'; card.addEventListener('click', () => showNftDetails(nft)); const imgUrl = convertIpfsUrl(nft.thumbnail_image || nft.image) || `https://placehold.co/300x300/1f2937/e5e7eb?text=No+Image`; const name = nft.name || `NFT #${nft.id || '?'}`; const title = name.replace('The AllianceDAO NFT', 'AllianceDAO NFT'); let traitsHtml = ''; const visTraits = traitOrder.filter(t => document.querySelector(`${toggleSelector}[data-trait="${t}"]`)?.checked); visTraits.forEach(trait => { let val = 'N/A'; if (trait === 'Rank' && nft.rank != null) val = `#${nft.rank}`; else if (trait === 'Rarity' && nft.rarityScore != null) val = nft.rarityScore.toFixed(2); else val = nft.attributes?.find(a => a.trait_type === trait)?.value || 'N/A'; traitsHtml += `<li class="flex justify-between items-center py-2 px-1 border-b border-gray-700 last:border-b-0"><span class="text-xs font-medium text-cyan-400 uppercase">${trait}</span><span class="text-sm font-semibold text-white truncate" title="${val}">${val}</span></li>`; }); card.innerHTML = `<div class="image-container aspect-w-1 aspect-h-1 w-full"><img src="${imgUrl}" alt="${name}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null; this.src='https://placehold.co/300x300/1f2937/e5e7eb?text=Error';"></div><div class="p-4 flex-grow flex flex-col"><h2 class="text-lg font-bold text-white mb-3 truncate" title="${title}">${title}</h2><ul class="text-sm flex-grow">${traitsHtml}</ul></div>`; const imgCont = card.querySelector('.image-container'); if (!imgCont) return card; const isDao = nft.owner === DAO_WALLET_ADDRESS || (nft.owner && DAO_LOCKED_WALLET_SUFFIXES.some(s => nft.owner.endsWith(s))); const hasBadges = nft.broken || nft.staked_daodao || nft.boost_market || nft.bbl_market || nft.staked_enterprise_legacy || isDao; if (hasBadges) { /* ... add badge toggle button ... */ const btn = document.createElement('button'); btn.className = 'top-left-toggle'; btn.title = 'Toggle badges'; btn.innerHTML = `<svg...>`; btn.type = 'button'; btn.addEventListener('click', (e) => { e.stopPropagation(); const hidden = imgCont.classList.toggle('badges-hidden'); btn.innerHTML = hidden ? `<svg...eye-off...>` : `<svg...eye...>`; }); imgCont.appendChild(btn); } if (nft.broken) { /* ... add broken banner ... */ const banner = document.createElement('div'); banner.className = 'broken-banner'; banner.textContent = 'BROKEN'; imgCont.appendChild(banner); } const stack = document.createElement('div'); stack.className = 'top-right-stack'; if (isDao) addBadge(stack, '...', 'Owned by DAO'); if (nft.staked_daodao) addBadge(stack, '...', 'Staked DAODAO'); if (nft.boost_market) addBadge(stack, '...', 'Listed Boost'); if (nft.bbl_market) addBadge(stack, '...', 'Listed BBL'); if (nft.staked_enterprise_legacy) addBadge(stack, '...', 'Staked Enterprise'); if (stack.children.length > 0) imgCont.appendChild(stack); return card;
};
function addBadge(container, src, alt) { /* ... adds badge image ... */ const img = document.createElement('img'); img.src = src; img.alt = alt; img.title = alt; img.className = 'overlay-icon'; container.appendChild(img); }
const updatePaginationControls = (totalPages) => { /* ... updates pagination buttons ... */ paginationControls.innerHTML = ''; if (totalPages <= 1) return; const prev = document.createElement('button'); prev.textContent = 'Previous'; prev.className = 'pagination-btn'; prev.disabled = currentPage === 1; prev.onclick = () => displayPage(currentPage - 1); paginationControls.appendChild(prev); const info = document.createElement('span'); info.className = 'text-gray-400'; info.textContent = `Page ${currentPage} of ${totalPages}`; paginationControls.appendChild(info); const next = document.createElement('button'); next.textContent = 'Next'; next.className = 'pagination-btn'; next.disabled = currentPage === totalPages; next.onclick = () => displayPage(currentPage + 1); paginationControls.appendChild(next); };
const resetAll = () => { /* ... resets all filters to default ... */ searchInput.value = ''; searchAddressInput.value = ''; addressDropdown.value = ''; sortSelect.value = 'asc'; document.querySelectorAll('.toggle-checkbox').forEach(t => { if (t.classList.contains('status-toggle-cb') || t.classList.contains('planet-toggle-cb') || t.classList.contains('inhabitant-toggle-cb')) { t.checked = false; const slider = document.querySelector(`.direction-slider[data-slider-key="${t.dataset.key}"]`); if (slider) { slider.value = 1; slider.disabled = true; } } }); document.querySelectorAll('.multi-select-container').forEach(c => { c.querySelectorAll('.multi-select-checkbox').forEach(cb => cb.checked = false); updateMultiSelectButtonText(c); }); document.querySelectorAll('.trait-toggle').forEach(t => t.checked = defaultTraitsOn.includes(t.dataset.trait)); handleFilterChange(); };

// --- updateFilterCounts remains the same, using the passed currentFilteredNfts ---
const updateFilterCounts = (currentFilteredNfts) => { /* ... updates counts based on currentFilteredNfts ... */
    const newCounts = {}; const currentInhabitantCounts = {}; const currentPlanetCounts = {};
    currentFilteredNfts.forEach(nft => { if (nft.attributes) { nft.attributes.forEach(attr => { /* ... count traits/inhabitants/planets ... */ if (!newCounts[attr.trait_type]) newCounts[attr.trait_type] = {}; newCounts[attr.trait_type][attr.value] = (newCounts[attr.trait_type][attr.value] || 0) + 1; if (attr.trait_type === 'Inhabitant') { /* ... */ const base = attr.value.replace(/ (M|F)$/, ''); if (!currentInhabitantCounts[base]) currentInhabitantCounts[base] = {total:0, male:0, female:0}; currentInhabitantCounts[base].total++; if(attr.value.endsWith(' M')) currentInhabitantCounts[base].male++; else if(attr.value.endsWith(' F')) currentInhabitantCounts[base].female++; } if (attr.trait_type === 'Planet') { /* ... */ const base = attr.value.replace(/ (North|South)$/, ''); if (!currentPlanetCounts[base]) currentPlanetCounts[base] = {total:0, north:0, south:0}; currentPlanetCounts[base].total++; if(attr.value.endsWith(' North')) currentPlanetCounts[base].north++; else if(attr.value.endsWith(' South')) currentPlanetCounts[base].south++; } }); } });
    document.querySelectorAll('.multi-select-container').forEach(c => { /* ... update multi-select counts/disabled ... */ const type = c.querySelector('[data-trait]')?.dataset.trait; if(!type) return; c.querySelectorAll('label').forEach(lbl => { const cb = lbl.querySelector('input'); if(!cb) return; const val = cb.value; const span = lbl.querySelector('.trait-count'); const count = newCounts[type]?.[val] || 0; if(span) span.textContent = count; if(count === 0 && !cb.checked){lbl.style.opacity='0.5'; lbl.style.cursor='not-allowed'; cb.disabled=true;} else {lbl.style.opacity='1'; lbl.style.cursor='pointer'; cb.disabled=false;} }); });
    document.querySelectorAll('.inhabitant-count').forEach(span => { /* ... update inhabitant counts ... */ const name = span.dataset.countKey; const slider = document.querySelector(`.gender-slider[data-slider-key="${name}"]`); const counts = currentInhabitantCounts[name] || {male:0, female:0}; if(slider){ if(slider.value==='0') span.textContent=counts.male; else if(slider.value==='1') span.textContent=counts.male+counts.female; else if(slider.value==='2') span.textContent=counts.female;} else span.textContent=counts.male+counts.female; });
    document.querySelectorAll('.planet-count').forEach(span => { /* ... update planet counts ... */ const name = span.dataset.countKey; const slider = document.querySelector(`.direction-slider[data-slider-key="${name}"]`); const counts = currentPlanetCounts[name] || {north:0, south:0}; if(slider){ if(slider.value==='0') span.textContent=counts.north; else if(slider.value==='1') span.textContent=counts.north+counts.south; else if(slider.value==='2') span.textContent=counts.south;} else span.textContent=counts.north+counts.south; });
    document.querySelectorAll('.status-count').forEach(span => { /* ... update status counts using currentFilteredNfts ... */ const key = span.dataset.countKey; const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`); if(!slider) return; let count = 0; const list = currentFilteredNfts; if (key === 'staked'){ const ent=list.filter(n=>n.staked_enterprise_legacy).length; const dao=list.filter(n=>n.staked_daodao).length; if(slider.value==='0') count=ent; else if(slider.value==='1') count=list.filter(n=>n.staked_enterprise_legacy||n.staked_daodao).length; else if(slider.value==='2') count=dao; } else if (key === 'listed'){ const boost=list.filter(n=>n.boost_market).length; const bbl=list.filter(n=>n.bbl_market).length; if(slider.value==='0') count=boost; else if(slider.value==='1') count=list.filter(n=>n.boost_market||n.bbl_market).length; else if(slider.value==='2') count=bbl; } else if (key === 'rewards'){ const broken=list.filter(n=>n.broken===true).length; const unbroken=list.filter(n=>n.broken===false).length; if(slider.value==='0') count=broken; else if(slider.value==='1') count=broken+unbroken; else if(slider.value==='2') count=unbroken; } else if (key === 'liquid_status'){ const liq=list.filter(n=>n.liquid===true).length; const notLiq=list.filter(n=>n.liquid===false).length; if(slider.value==='0') count=liq; else if(slider.value==='1') count=list.length; else if(slider.value==='2') count=notLiq; } else if (key === 'mint_status'){ const unmint=list.filter(n=>n.owner===DAO_WALLET_ADDRESS).length; const mint=list.filter(n=>n.owner!==DAO_WALLET_ADDRESS).length; if(slider.value==='0') count=unmint; else if(slider.value==='1') count=list.length; else if(slider.value==='2') count=mint; } span.textContent = count; });
};


// ... (Modal/Preview functions remain the same) ...
const findHighestRaritySample = (filterFn) => { /* ... finds sample NFT ... */ const match = allNfts.filter(filterFn); if (match.length === 0) return null; match.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)); return match[0]; };
const showPreviewTile = (event, traitType, value) => { /* ... shows preview tile ... */ const tile=document.getElementById('preview-tile'); const c1=document.getElementById('preview-container-1'); const i1=document.getElementById('preview-image-1'); const n1=document.getElementById('preview-name-1'); const c2=document.getElementById('preview-container-2'); const i2=document.getElementById('preview-image-2'); const n2=document.getElementById('preview-name-2'); let s1=null, s2=null; if (traitType === 'Object') s1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === 'Object' && a.value === value)); else if (traitType === 'Inhabitant' || traitType === 'Planet') { const slider=event.currentTarget.querySelector('input[type="range"]'); const sliderVal = slider ? slider.value : '1'; if (sliderVal === '1'){ const suf1 = traitType === 'Inhabitant' ? ' M' : ' North'; const suf2 = traitType === 'Inhabitant' ? ' F' : ' South'; s1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suf1)); s2 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suf2)); if (!s1 && !s2) s1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value.startsWith(value))); else if (!s1) s1 = s2; } else { const suf = (traitType === 'Inhabitant' ? (sliderVal === '0' ? ' M' : ' F') : (sliderVal === '0' ? ' North' : ' South')); s1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suf)); } } if(s1){i1.src=convertIpfsUrl(s1.thumbnail_image||s1.image)||'placeholder'; n1.textContent=s1.attributes?.find(a=>a.trait_type===traitType)?.value||value; c1.classList.remove('hidden');} else {c1.classList.add('hidden');i1.src='';n1.textContent='';} if(s2){i2.src=convertIpfsUrl(s2.thumbnail_image||s2.image)||'placeholder'; n2.textContent=s2.attributes?.find(a=>a.trait_type===traitType)?.value||value; c2.classList.remove('hidden');} else {c2.classList.add('hidden');i2.src='';n2.textContent='';} if(s1||s2){const width=s2?330:160; let x=event.clientX+20; let y=event.clientY+10; if(x+width>window.innerWidth) x=event.clientX-width-20; if(y+tile.offsetHeight>window.innerHeight) y=window.innerHeight-tile.offsetHeight-10; if(x<0)x=10; if(y<0)y=10; tile.style.left=`${x}px`; tile.style.top=`${y}px`; tile.classList.remove('hidden');} else hidePreviewTile(); };
const hidePreviewTile = () => document.getElementById('preview-tile').classList.add('hidden');
const showCopyToast = (text) => { /* ... shows toast message ... */ copyToast.textContent = text; copyToast.classList.add('show'); setTimeout(() => { copyToast.classList.remove('show'); }, 2000); };
const copyToClipboard = (textToCopy, typeName = 'Address') => { /* ... copies text ... */ if (!textToCopy) return; navigator.clipboard.writeText(textToCopy).then(() => { const short = textToCopy.length > 10 ? `${textToCopy.substring(0, 5)}...${textToCopy.substring(textToCopy.length - 5)}` : textToCopy; showCopyToast(`Copied ${typeName}: ${short}`); }).catch(err => { console.error('Copy failed: ', err); try { const input = document.createElement('input'); input.value=textToCopy; document.body.appendChild(input); input.select(); document.execCommand('copy'); document.body.removeChild(input); const short = textToCopy.length > 10 ? `...` : textToCopy; showCopyToast(`Copied ${typeName}: ${short}`); } catch (e) { showCopyToast(`Failed!`); } }); };
const showNftDetails = (nft) => { /* ... shows NFT details modal ... */ document.getElementById('modal-image').src=convertIpfsUrl(nft.image)||'placeholder'; document.getElementById('modal-title').textContent=(nft.name||`NFT #${nft.id||'?'}`).replace('The AllianceDAO NFT','AllianceDAO NFT'); let traitsHtml=`...`; const attrs=(nft.attributes||[]).filter(a=>traitOrder.includes(a.trait_type)&&!['Rank','Rarity'].includes(a.trait_type)).sort((a,b)=>traitOrder.indexOf(a.trait_type)-traitOrder.indexOf(b.trait_type)); traitsHtml+=attrs.map(a=>`<div...>${a.trait_type}:</span><span...>${a.value||'N/A'}</span></div>`).join(''); traitsHtml+=`<div...border.../>`; const isStaked=nft.staked_daodao||nft.staked_enterprise_legacy; const isListed=nft.bbl_market||nft.boost_market; let statusTxt='Unknown'; if(nft.owner===DAO_WALLET_ADDRESS||(nft.owner&&DAO_LOCKED_WALLET_SUFFIXES.some(s=>nft.owner.endsWith(s)))) statusTxt='DAO Owned'; else if(nft.liquid===true) statusTxt='Liquid (In Wallet)'; else if(isStaked) statusTxt=`Staked (${nft.staked_daodao?'DAODAO':'Enterprise'})`; else if(isListed) statusTxt=`Listed (${nft.bbl_market?'BBL':'Boost'})`; else if(nft.liquid===false) statusTxt='In Wallet (Not Liquid)'; traitsHtml+=`<div...>${statusTxt}</span></div>`; traitsHtml+=`<div...>${nft.broken?'Yes':'No'}</span></div>`; traitsHtml+=`<div...border.../>`; traitsHtml+=`<div...>${nft.owner||'N/A'}</span></div>`; const modalTraits=document.getElementById('modal-traits'); modalTraits.innerHTML=traitsHtml; const ownerEl=modalTraits.querySelector('.owner-address'); if(nft.owner&&ownerEl) ownerEl.addEventListener('click',()=>copyToClipboard(nft.owner,'Owner Addr')); else if(ownerEl){ownerEl.style.cursor='default'; ownerEl.removeAttribute('title');} document.getElementById('modal-link').href=convertIpfsUrl(nft.image); const dlBtn=document.getElementById('download-post-btn'); dlBtn.textContent='Download Post'; dlBtn.onclick=()=>generateShareImage(nft,dlBtn); nftModal.classList.remove('hidden'); };
const hideNftDetails = () => nftModal.classList.add('hidden');
const findRarestTrait = (nft) => { /* ... finds rarest trait ... */ if (!nft.attributes||!traitCounts) return {value:'N/A', trait_type:'Unknown'}; let rarest=null, min=Infinity; nft.attributes.forEach(a=>{if(traitCounts[a.trait_type]?.[a.value]&&!['Weather','Light'].includes(a.trait_type)){const c=traitCounts[a.trait_type][a.value]; if(c<min){min=c; rarest=a;}}}); return rarest||{value:'N/A', trait_type:'Unknown'}; };
const generateShareImage = (nft, button) => { /* ... generates share image ... */ button.textContent='Generating...'; button.disabled=true; const canvas=document.getElementById('share-canvas'); const ctx=canvas.getContext('2d'); const img=new Image(); img.crossOrigin="anonymous"; const imgUrl=convertIpfsUrl(nft.image)||convertIpfsUrl(nft.thumbnail_image)||null; if(!imgUrl){button.textContent='No Image'; setTimeout(()=>{button.textContent='Download Post'; button.disabled=false;},2000); return;} img.src=imgUrl; img.onload=()=>{ canvas.width=1080; canvas.height=1080; ctx.clearRect(0,0,1080,1080); try {ctx.drawImage(img,0,0,1080,1080);} catch(e){button.textContent='Draw Error'; setTimeout(()=>{/*...*/},2000); return;} /* ... add text/banner ... */ ctx.fillStyle='white'; ctx.strokeStyle='black'; ctx.lineWidth=8; ctx.font='bold 48px Inter'; ctx.lineJoin='round'; const m=40; const drawTxt=(txt,x,y,align='left')=>{ctx.textAlign=align; ctx.strokeText(txt,x,y); ctx.fillText(txt,x,y);}; drawTxt(`NFT #${nft.id||'?'}`,m,m+48,'left'); drawTxt(`Rank #${nft.rank||'N/A'}`,1080-m,m+48,'right'); const planet=nft.attributes?.find(a=>a.trait_type==='Planet')?.value||'N/A'; drawTxt(planet,m,1080-m,'left'); let inhab=nft.attributes?.find(a=>a.trait_type==='Inhabitant')?.value||'N/A'; if(inhab.endsWith(' M')) inhab=inhab.replace(' M',' Male'); else if(inhab.endsWith(' F')) inhab=inhab.replace(' F',' Female'); drawTxt(inhab,1080-m,1080-m,'right'); const bannerH=120, bannerY=1080-bannerH-80; if(nft.broken){ctx.fillStyle='rgba(220,38,38,0.85)'; ctx.fillRect(0,bannerY,1080,bannerH); ctx.fillStyle='white'; ctx.textAlign='center'; ctx.font='bold 60px Inter'; drawTxt('BROKEN',540,bannerY+85,'center');} else {ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,bannerY,1080,bannerH); const strength=findRarestTrait(nft); ctx.fillStyle='white'; ctx.textAlign='center'; ctx.font='bold 40px Inter'; drawTxt(`Rarest: ${strength.value||'N/A'}`,540,bannerY+75,'center');} try {const link=document.createElement('a'); link.download=`AllianceDAO_NFT_${nft.id||'Unk'}.png`; link.href=canvas.toDataURL('image/png'); link.click(); button.textContent='Downloaded!';} catch(e){button.textContent='Download Failed';} setTimeout(()=>{button.textContent='Download Post'; button.disabled=false;},2000); }; img.onerror=()=>{button.textContent='Load Error'; setTimeout(()=>{/*...*/},3000);} };


// --- Wallet View Logic ---
const calculateAndDisplayLeaderboard = () => { /* ... calculates leaderboard stats using updated liquid logic ... */ if (allNfts.length === 0) return; const ownerStats = {}; allNfts.forEach(nft => { if (nft.owner) { if (!ownerStats[nft.owner]) ownerStats[nft.owner] = { address: nft.owner, total: 0, liquid: 0, daodaoStaked: 0, enterpriseStaked: 0, broken: 0, unbroken: 0, bblListed: 0, boostListed: 0 }; const s = ownerStats[nft.owner]; s.total++; if (nft.liquid) s.liquid++; if (nft.staked_daodao) s.daodaoStaked++; if (nft.staked_enterprise_legacy) s.enterpriseStaked++; if (nft.bbl_market) s.bblListed++; if (nft.boost_market) s.boostListed++; if (nft.broken) s.broken++; else s.unbroken++; } }); allHolderStats = Object.values(ownerStats); sortAndDisplayHolders(); };
const sortAndDisplayHolders = () => { /* ... sorts and triggers display ... */ const { column, direction } = holderSort; const sorted = [...allHolderStats].sort((a, b) => { const vA = a[column]; const vB = b[column]; const nA = typeof vA === 'number' ? vA : -Infinity; const nB = typeof vB === 'number' ? vB : -Infinity; if (column === 'address') return direction === 'asc' ? (vA || '').localeCompare(vB || '') : (vB || '').localeCompare(vA || ''); else return direction === 'asc' ? nA - nB : nB - nA; }); allHolderStats = sorted; displayHolderPage(1); };
const displayHolderPage = (page) => { /* ... displays a page of the leaderboard ... */ holderCurrentPage = page; leaderboardTable.innerHTML = ''; const table = document.createElement('table'); const thead = document.createElement('thead'); const tbody = document.createElement('tbody'); const headerRow = document.createElement('tr'); const createHdr = (lbl, key) => { const th = document.createElement('th'); const span = document.createElement('span'); span.dataset.sortBy = key; const isSort = holderSort.column === key; const asc = isSort && holderSort.direction === 'asc'; const desc = isSort && holderSort.direction === 'desc'; if (isSort) span.classList.add('sort-active'); span.innerHTML = `${lbl}<svg class="sort-icon...${asc?'active':''}"...></svg><svg class="sort-icon...${desc?'active':''}"...></svg>`; th.appendChild(span); return th; }; const hdrData = [ {lbl:'Rank'}, {lbl:'Holder', key:'address'}, {lbl:'Liquid', key:'liquid'}, {lbl:'DAODAO', key:'daodaoStaked'}, {lbl:'Enterprise', key:'enterpriseStaked'}, {lbl:'Broken', key:'broken'}, {lbl:'Unbroken', key:'unbroken'}, {lbl:'BBL', key:'bblListed'}, {lbl:'Boost', key:'boostListed'}, {lbl:'Total', key:'total'} ]; hdrData.forEach(h => { if(h.key) headerRow.appendChild(createHdr(h.lbl, h.key)); else { const th=document.createElement('th'); th.textContent=h.lbl; headerRow.appendChild(th); } }); thead.appendChild(headerRow); table.appendChild(thead); const items = allHolderStats.slice((page-1)*holdersPerPage, page*holdersPerPage); items.forEach(({address, ...stats}, idx) => { const row=document.createElement('tr'); row.className='leaderboard-row-item'; row.dataset.address=address; const rank=(page-1)*holdersPerPage+idx+1; const short=address?`terra...${address.slice(-4)}`:'N/A'; const createCell=(val,cls=[],title='')=>{const td=document.createElement('td'); td.textContent=val??'0'; if(cls.length>0)td.classList.add(...cls); if(title)td.title=title; return td;}; row.appendChild(createCell(`#${rank}`,['font-bold'])); row.appendChild(createCell(short,['font-mono','text-sm'],address)); row.appendChild(createCell(stats.liquid)); row.appendChild(createCell(stats.daodaoStaked, stats.daodaoStaked>0?['text-cyan-400']:[]) ); /* ... more cells ... */ row.appendChild(createCell(stats.enterpriseStaked, stats.enterpriseStaked>0?['text-gray-400']:[]) ); row.appendChild(createCell(stats.broken, stats.broken>0?['text-red-400']:[]) ); row.appendChild(createCell(stats.unbroken, stats.unbroken>0?['text-green-400']:[]) ); row.appendChild(createCell(stats.bblListed, stats.bblListed>0?['text-green-400']:[]) ); row.appendChild(createCell(stats.boostListed, stats.boostListed>0?['text-purple-400']:[]) ); row.appendChild(createCell(stats.total,['font-bold'])); row.addEventListener('click', ()=>{if(address){walletSearchAddressInput.value=address; searchWallet(); document.querySelectorAll('#lb-table tbody tr.selected').forEach(r=>r.classList.remove('selected')); row.classList.add('selected');}}); tbody.appendChild(row); }); table.appendChild(tbody); leaderboardTable.appendChild(table); updateHolderPaginationControls(); };
const updateHolderPaginationControls = () => { /* ... updates leaderboard pagination ... */ leaderboardPagination.innerHTML=''; const totalPgs=Math.ceil(allHolderStats.length/holdersPerPage); if(totalPgs<=1)return; const prev=document.createElement('button'); prev.textContent='Prev'; prev.className='pagination-btn'; prev.disabled=holderCurrentPage===1; prev.onclick=()=>displayHolderPage(holderCurrentPage-1); leaderboardPagination.appendChild(prev); const info=document.createElement('span'); info.className='text-gray-400'; info.textContent=`Page ${holderCurrentPage} of ${totalPgs}`; leaderboardPagination.appendChild(info); const next=document.createElement('button'); next.textContent='Next'; next.className='pagination-btn'; next.disabled=holderCurrentPage===totalPgs; next.onclick=()=>displayHolderPage(holderCurrentPage+1); leaderboardPagination.appendChild(next); };

// --- Map View Logic ---
// ... (map functions remain the same: addMapListeners, removeMapListeners, initializeStarfield, etc.) ...
let mapListenersAdded = false;
function addMapListeners() { if (mapListenersAdded || !spaceCanvas) return; console.log("Adding map listeners."); spaceCanvas.addEventListener('contextmenu', handleMapContextMenu); spaceCanvas.addEventListener('mousedown', handleMapMouseDown); window.addEventListener('mouseup', handleMapMouseUp); spaceCanvas.addEventListener('mouseleave', handleMapMouseLeave); spaceCanvas.addEventListener('mousemove', handleMapMouseMove); spaceCanvas.addEventListener('wheel', handleMapWheel, { passive: false }); spaceCanvas.addEventListener('click', handleMapClick); mapListenersAdded = true; }
function removeMapListeners() { if (!mapListenersAdded || !spaceCanvas) return; console.log("Removing map listeners."); spaceCanvas.removeEventListener('contextmenu', handleMapContextMenu); spaceCanvas.removeEventListener('mousedown', handleMapMouseDown); window.removeEventListener('mouseup', handleMapMouseUp); spaceCanvas.removeEventListener('mouseleave', handleMapMouseLeave); spaceCanvas.removeEventListener('mousemove', handleMapMouseMove); spaceCanvas.removeEventListener('wheel', handleMapWheel, { passive: false }); spaceCanvas.removeEventListener('click', handleMapClick); mapListenersAdded = false; }
 const initializeStarfield = () => { if (!spaceCanvas) { console.error("Canvas not found!"); return; } if (isMapInitialized && globalAnimationFrameId) { console.log("Map running."); return; } if (isMapInitialized && !globalAnimationFrameId) { console.log("Restarting map animation."); animate(); return; } console.log("Initializing starfield..."); const ctx = spaceCanvas.getContext('2d'); if (!ctx) { console.error("No context."); return; } mapStars = []; mapObjects = []; mapZoom = 0.15; mapRotation = 0; mapOffsetX = 0; mapOffsetY = 0; isPanning = false; isRotating = false; lastMouseX = 0; lastMouseY = 0; const minZoom = 0.1, maxZoom = 5; function setCanvasSize() { const dW = spaceCanvas.clientWidth; const dH = spaceCanvas.clientHeight; if (spaceCanvas.width !== dW || spaceCanvas.height !== dH) { spaceCanvas.width = dW; spaceCanvas.height = dH; console.log(`Canvas resized: ${dW}x${dH}`); return true; } return false; } function createStars() { mapStars = []; const w = spaceCanvas.width, h = spaceCanvas.height; if (w === 0 || h === 0) return; const count = (w * h * 4) / 1000; for (let i = 0; i < count; i++) mapStars.push({ x: (Math.random() - 0.5) * w * 10, y: (Math.random() - 0.5) * h * 10, radius: Math.random() * 1.5 + 0.5, alpha: Math.random(), twinkleSpeed: Math.random() * 0.03 + 0.005, twinkleDirection: 1 }); } function drawGalaxy() { if (!ctx || !spaceCanvas) return; ctx.save(); ctx.clearRect(0, 0, spaceCanvas.width, spaceCanvas.height); if (spaceCanvas.width === 0 || spaceCanvas.height === 0) { ctx.restore(); return; } ctx.translate(spaceCanvas.width / 2 + mapOffsetX, spaceCanvas.height / 2 + mapOffsetY); ctx.scale(mapZoom, mapZoom); ctx.rotate(mapRotation); mapStars.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; ctx.fill(); }); const lineColors = { daodao:'rgba(56,189,248,0.7)', bbl:'rgba(16,185,129,0.7)', boost:'rgba(168,85,247,0.7)', enterprise:'rgba(56,189,248,0.7)' }; mapObjects.forEach(o => { if (o.lineTargetId) { const t = mapObjects.find(t => t.id === o.lineTargetId); if (t) { ctx.beginPath(); ctx.moveTo(o.x, o.y); if (o.lineTargetId === 'enterprise') { /*...*/ } else if (o.id.startsWith('satellite')) { /*...*/ } else ctx.lineTo(t.x, t.y); ctx.strokeStyle = lineColors[o.system] || 'grey'; ctx.lineWidth = 2 / mapZoom; ctx.stroke(); } } }); mapObjects.forEach(o => { if (!o.img || !o.img.complete || !(o.width > 0) || !(o.height > 0)) return; let dW = o.width * o.scale, dH = o.height * o.scale; ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rotation || 0); try { ctx.drawImage(o.img, -dW / 2, -dH / 2, dW, dH); } catch (e) {} ctx.restore(); if(o.textAbove || o.textBelow) { /*...*/ } }); ctx.restore(); } function updateStars() { mapStars.forEach(s => { s.alpha += s.twinkleSpeed * s.twinkleDirection; if (s.alpha > 1 || s.alpha < 0) { s.alpha = Math.max(0, Math.min(1, s.alpha)); s.twinkleDirection *= -1; } }); } function updateObjectRotations() { mapObjects.forEach(o => { if (o.rotationSpeed && !o.isFrozen) o.rotation = (o.rotation || 0) + o.rotationSpeed; }); } function animate() { if (!isMapInitialized || !spaceCanvas || !document.body.contains(spaceCanvas) || mapView.classList.contains('hidden')) { if (globalAnimationFrameId) cancelAnimationFrame(globalAnimationFrameId); globalAnimationFrameId = null; return; } setCanvasSize(); updateStars(); updateObjectRotations(); drawGalaxy(); globalAnimationFrameId = requestAnimationFrame(animate); } function addMapObject(cfg, imgs) { const img = imgs[cfg.imageId]; if (!img || !img.width || !img.height) return; mapObjects.push({ ...cfg, img: img, width: img.width, height: img.height, isFrozen: false, rotation: cfg.rotation || 0 }); } function initMap() { console.log("Init Map"); if (globalAnimationFrameId) cancelAnimationFrame(globalAnimationFrameId); globalAnimationFrameId = null; if (!spaceCanvas) return; setCanvasSize(); if (spaceCanvas.width === 0 || spaceCanvas.height === 0) { console.error("Canvas zero size in initMap"); return; } mapObjects = []; createStars(); const assets = { daodao:'...', bbl:'...', boost:'...', enterprise:'...', allianceLogo:'...', terra:'...' }; /* URLs */ assets.daodao= 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/daodao-planet.png'; assets.bbl='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/bbl-planet.png'; assets.boost='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/boost-ship.png'; assets.enterprise='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/enterprise-blackhole.png'; assets.allianceLogo='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/aDAO%20Logo%20No%20Background.png'; assets.terra='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/Terra.PNG'; const promises = Object.entries(assets).map(([id, url]) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin="anon"; i.onload=()=>res({id,img:i}); i.onerror=rej; i.src=url; })); Promise.all(promises).then(loaded => { const imgs = loaded.reduce((acc, {id, img})=>{acc[id]=img; return acc;},{}); setCanvasSize(); if (spaceCanvas.width === 0 || spaceCanvas.height === 0) { console.error("Canvas zero after img load"); isMapInitialized = false; return; } buildGalaxySystems(imgs); isMapInitialized = true; console.log("Map init done, starting anim."); animate(); }).catch(err => { console.error("Img load err:", err); isMapInitialized = false; }); } function buildGalaxySystems(imgs) { const w = spaceCanvas.width, h = spaceCanvas.height; if (w === 0 || h === 0) return; const centers = { daodao:{x:0, y:-h*2}, bbl:{x:-w*2, y:0}, boost:{x:w*2, y:0}, enterprise:{x:0, y:h*2} }; addMapObject({ id:'terra', imageId:'terra', type:'planet', x:0, y:0, scale:0.25, rot:0 }, imgs); const addCenter = (id, imgId, type, scale, spin) => addMapObject({ id, imageId:imgId, type, x:centers[id].x, y:centers[id].y, scale, rot:0, rotationSpeed:spin?(Math.random()-0.5)*0.002:0 }, imgs); const bblCt=allNfts.filter(n=>n.bbl_market).length, boostCt=allNfts.filter(n=>n.boost_market).length, entCt=allNfts.filter(n=>n.staked_enterprise_legacy).length; addCenter('daodao','daodao','planet',0.5,true); addCenter('bbl','bbl','planet',bblCt>0?(bblCt/59)*0.5:0.1,true); addCenter('boost','boost','ship_main',boostCt>0?(boostCt/59)*0.5:0.1,true); addCenter('enterprise','enterprise','blackhole',entCt>0?(entCt/515)*0.5:0.1,true); const holderStats = {}; allNfts.forEach(nft=>{ if(nft.owner){ if(!holderStats[nft.owner]) holderStats[nft.owner] = {total:0, daodaoStaked:0, bblListed:0, boostListed:0, enterpriseStaked:0}; const s=holderStats[nft.owner]; s.total++; if(nft.staked_daodao)s.daodaoStaked++; if(nft.bbl_market)s.bblListed++; if(nft.boost_market)s.boostListed++; if(nft.staked_enterprise_legacy)s.enterpriseStaked++; } }); const createFleet = (sysId, statKey) => { const center = centers[sysId]; const top = Object.entries(holderStats).filter(([_,s])=>s[statKey]>0).sort(([_,a],[_,b])=>b[statKey]-a[statKey]).slice(0,10).map(([adr,s])=>({address:adr,...s})); if(top.length===0) return; const counts=top.map(s=>s[statKey]); const minC=counts.length>0?Math.min(...counts):1; const maxC=counts.length>0?Math.max(...counts):1; const rangeC=maxC>minC?maxC-minC:1; const minS=0.1, maxS=0.3, rangeS=maxS-minS; const curW=spaceCanvas.width, curH=spaceCanvas.height; const minR=Math.min(curW,curH)*0.6; const maxR=Math.min(curW,curH)*1.5; const rangeR=maxR-minR; const stepA=(2*Math.PI)/top.length; top.forEach((s,i)=>{const{address:adr,total:tot}=s; const platCt=s[statKey]; const ang=stepA*i; const normSize=rangeC===1?0:(platCt-minC)/rangeC; const dist=minR+(normSize*rangeR); const scale=minS+(normSize*rangeS); const last4=adr.slice(-4); const mX=center.x+Math.cos(ang)*dist; const mY=center.y+Math.sin(ang)*dist; addMapObject({id:`mothership_${sysId}_${adr}`, imageId:'allianceLogo', type:'ship', address:adr, system:sysId, lineTargetId:`satellite_${sysId}_${adr}`, x:mX, y:mY, scale:scale, textAbove:`${tot-platCt}`, textBelow:last4}, imgs); addMapObject({id:`satellite_${sysId}_${adr}`, imageId:'allianceLogo', type:'ship', address:adr, system:sysId, lineTargetId:sysId, x:(mX+center.x)/2, y:(mY+center.y)/2, scale:scale*0.8, textAbove:`${platCt}`, textBelow:last4}, imgs); }); }; const createEnt = () => { const curW=spaceCanvas.width, curH=spaceCanvas.height; if(curW===0||curH===0)return; const center=centers.enterprise; const statKey='enterpriseStaked'; const top=Object.entries(holderStats).filter(([_,s])=>s.enterpriseStaked>0).sort(([_,a],[_,b])=>b.enterpriseStaked-a.enterpriseStaked).slice(0,10).map(([adr,s])=>({address:adr,...s})); if(top.length===0) return; const counts=top.map(s=>s.enterpriseStaked); const minC=Math.min(...counts); const maxC=Math.max(...counts); const rangeC=maxC>minC?maxC-minC:1; const minS=0.1, maxS=0.3, rangeS=maxS-minS; const minR=Math.min(curW,curH)*0.6; const maxR=Math.min(curW,curH)*1.2; const rangeR=maxR-minR; const stepA=(2*Math.PI)/top.length; top.forEach((s,i)=>{ const{address:adr, enterpriseStaked:entCt}=s; const ang=stepA*i; const normSize=rangeC===1?0:(entCt-minC)/rangeC; const dist=minR+(normSize*rangeR); const scale=minS+(normSize*rangeS); addMapObject({id:`ship_enterprise_${adr}`, imageId:'allianceLogo', type:'ship', address:adr, system:'enterprise', lineTargetId:'enterprise', x:center.x+Math.cos(ang)*dist, y:center.y+Math.sin(ang)*dist, scale:scale, textAbove:`${entCt}`, textBelow:adr.slice(-4)}, imgs); }); }; createFleet('daodao','daodaoStaked'); createFleet('bbl','bblListed'); createFleet('boost','boostListed'); createEnt(); console.log("Galaxy built."); } initMap(); };


// --- Reusable Address Search Handler ---
const debouncedFilter = debounce(handleFilterChange, 300);

const handleAddressInput = (inputEl, suggestionsEl, onSelectCallback, isWallet) => {
    const input = inputEl.value.toLowerCase();
    const reversedSearchTerm = input.split('').reverse().join('');
    suggestionsEl.innerHTML = '';

    if (!input) {
        suggestionsEl.classList.add('hidden');
        // Use currentFilteredOwnerAddresses for suggestions if available, else fallback to ownerAddresses
        const sourceList = currentFilteredOwnerAddresses.length > 0 ? currentFilteredOwnerAddresses : ownerAddresses;
        // Don't trigger filter on empty input unless it's the main collection search being cleared
        if (!isWallet && searchAddressInput.value === '') debouncedFilter();
        return;
    }

    // Filter based on the currently relevant owner list
    const sourceList = currentFilteredOwnerAddresses.length > 0 ? currentFilteredOwnerAddresses : ownerAddresses;
    let matches = sourceList.filter(addr => addr.toLowerCase().endsWith(reversedSearchTerm));

    const sortIndex = reversedSearchTerm.length;
     matches.sort((a, b) => { /* ... sort matches ... */
         const charA = a.charAt(a.length - 1 - sortIndex) || ''; const charB = b.charAt(b.length - 1 - sortIndex) || ''; return charA.localeCompare(charB);
      });

    if (matches.length > 0) {
        matches.slice(0, 10).forEach(match => { /* ... create suggestion items ... */
            const item = document.createElement('div'); item.className = 'address-suggestion-item'; const startIdx = match.length - reversedSearchTerm.length; item.innerHTML = `${match.substring(0, startIdx)}<strong class="text-cyan-400">${match.substring(startIdx)}</strong>`; item.style.direction = 'ltr'; item.style.textAlign = 'left';
            item.onclick = () => { inputEl.value = match; suggestionsEl.classList.add('hidden'); onSelectCallback(); }; suggestionsEl.appendChild(item);
         });
        if (matches.length > 10) { /* ... add 'more' indicator ... */ const item = document.createElement('div'); item.className='address-suggestion-item text-gray-400'; item.textContent=`${matches.length-10} more...`; suggestionsEl.appendChild(item); }
        suggestionsEl.classList.remove('hidden');
    } else {
        suggestionsEl.classList.add('hidden');
    }

    // IMPORTANT: Trigger filter update for collection view ONLY when typing
    if (!isWallet) {
        debouncedFilter();
    }
};


// ... (Modal functions remain the same) ...
const showWalletExplorerModal = (address) => { /* ... shows wallet modal ... */ const nfts = allNfts.filter(n=>n.owner===address); if(nfts.length===0) return; const title=document.getElementById('wallet-modal-title'); const statsEl=document.getElementById('wallet-modal-stats'); const galEl=document.getElementById('wallet-modal-gallery'); if(!title||!statsEl||!galEl) return; title.textContent=address; statsEl.innerHTML=''; galEl.innerHTML=''; const dStaked=nfts.filter(n=>n.staked_daodao).length; const eStaked=nfts.filter(n=>n.staked_enterprise_legacy).length; const bListed=nfts.filter(n=>n.boost_market).length; const bblListed=nfts.filter(n=>n.bbl_market).length; const brkn=nfts.filter(n=>n.broken).length; const tot=nfts.length; const unbrkn=tot-brkn; const liq=nfts.filter(n=>n.liquid).length; const stats=[{lbl:'Total', val:tot, clr:'white'}, {lbl:'Liquid', val:liq, clr:'white'}, {lbl:'DAODAO', val:dStaked, clr:'cyan-400'}, {lbl:'Enterprise', val:eStaked, clr:'gray-400'}, {lbl:'Boost', val:bListed, clr:'purple-400'}, {lbl:'BBL', val:bblListed, clr:'green-400'}, {lbl:'Unbroken', val:unbrkn, clr:'green-400'}, {lbl:'Broken', val:brkn, clr:'red-400'}]; stats.forEach(s=>{statsEl.innerHTML+=`<div class="text-center"><div class="text-xs text-gray-400 uppercase tracking-wider">${s.lbl}</div><div class="text-2xl font-bold text-${s.clr}">${s.val}</div></div>`;}); nfts.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)).forEach(n=>{galEl.appendChild(createNftCard(n,'.wallet-trait-toggle'));}); walletExplorerModal.classList.remove('hidden'); };
const hideWalletExplorerModal = () => walletExplorerModal.classList.add('hidden');
const showSystemLeaderboardModal = (sysId) => { /* ... shows system leaderboard ... */ const keyMap={daodao:'daodaoStaked', bbl:'bblListed', boost:'boostListed', enterprise:'enterpriseStaked'}; const nameMap={daodao:'DAODAO', bbl:'BBL', boost:'Boost', enterprise:'Enterprise'}; const statKey=keyMap[sysId]; if(!statKey)return; const data=Object.values(allHolderStats).filter(s=>s[statKey]>0).sort((a,b)=>b[statKey]-a[statKey]); const title=document.getElementById('system-modal-title'); const disclaimer=document.getElementById('system-modal-disclaimer'); if(!title||!disclaimer)return; title.textContent=`${nameMap[sysId]} Leaderboard`; if(sysId==='boost'){disclaimer.innerHTML=`<strong>Note:</strong> ...Boost contract...`; disclaimer.classList.remove('hidden');} else disclaimer.classList.add('hidden'); displaySystemLeaderboardPage(data,statKey,1); systemLeaderboardModal.classList.remove('hidden'); };
const displaySystemLeaderboardPage = (data, statKey, page) => { /* ... displays system leaderboard page ... */ const tbl=document.getElementById('system-modal-table'); const pag=document.getElementById('system-modal-pagination'); if(!tbl||!pag)return; const ipp=10; tbl.innerHTML=''; pag.innerHTML=''; const pageData=data.slice((page-1)*ipp, page*ipp); let html=`<div class="leaderboard-header"...>...</div>`; pageData.forEach((s,idx)=>{const rank=(page-1)*ipp+idx+1; html+=`<div class="leaderboard-row"...>...${rank}...${s.address}...${s[statKey]??0}...</div>`;}); tbl.innerHTML=html; const totalPgs=Math.ceil(data.length/ipp); if(totalPgs>1){/*...pagination...*/ const prev=document.createElement('button'); prev.textContent='Prev'; prev.className='pagination-btn'; prev.disabled=page===1; prev.onclick=()=>displaySystemLeaderboardPage(data,statKey,page-1); pag.appendChild(prev); const info=document.createElement('span'); info.className='text-gray-400'; info.textContent=`Page ${page} of ${totalPgs}`; pag.appendChild(info); const next=document.createElement('button'); next.textContent='Next'; next.className='pagination-btn'; next.disabled=page===totalPgs; next.onclick=()=>displaySystemLeaderboardPage(data,statKey,page+1); pag.appendChild(next); } };
const hideSystemLeaderboardModal = () => systemLeaderboardModal.classList.add('hidden');
const searchWallet = () => { /* ... searches and displays wallet NFTs ... */ const adr = walletSearchAddressInput.value.trim(); walletAddressSuggestions.classList.add('hidden'); document.querySelectorAll('#leaderboard-table tbody tr').forEach(r => r.classList.toggle('selected', r.dataset.address === adr)); if (!adr) { showError(walletGallery, 'Enter address.'); walletGalleryTitle.textContent = 'Wallet NFTs'; return; } const nfts = allNfts.filter(n => n.owner === adr); walletGalleryTitle.textContent = `Found ${nfts.length} for wallet:`; walletGallery.innerHTML = ''; if (nfts.length === 0) { showLoading(walletGallery, 'No NFTs found.'); return; } nfts.sort((a,b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).forEach(n => walletGallery.appendChild(createNftCard(n, '.wallet-trait-toggle'))); };


// --- Initialize Application ---
initializeExplorer();

