// --- Global Elements ---
// ... (rest of elements remain the same) ...
const spaceCanvas = document.getElementById('space-canvas');


// --- Config ---
const METADATA_URL = "https://cdn.jsdelivr.net/gh/defipatriot/nft-metadata/all_nfts_metadata.json";
const STATUS_DATA_URL = "https://deving.zone/en/nfts/alliance_daos.json";
const DAO_WALLET_ADDRESS = "terra1sffd4efk2jpdt894r04qwmtjqrrjfc52tmj6vkzjxqhd8qqu2drs3m5vzm";
// Add the endings of the DAO-controlled wallets considered non-liquid
const DAO_LOCKED_WALLET_SUFFIXES = [
    "8ywv", // From image_30a8ab.png
    "417v", // From image_30a8ab.png
    "6ugw"  // From image_30a8ab.png
];
const itemsPerPage = 20;
const traitOrder = ["Rank", "Rarity", "Planet", "Inhabitant", "Object", "Weather", "Light"];
const filterLayoutOrder = ["Rarity", "Object", "Weather", "Light"];
const defaultTraitsOn = ["Rank", "Planet", "Inhabitant", "Object"];

// --- State ---
// ... (rest of state remains the same) ...
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
let globalAnimationFrameId;
let isMapInitialized = false;
let mapZoom = 0.15, mapRotation = 0, mapOffsetX = 0, mapOffsetY = 0;
let isPanning = false, isRotating = false;
let lastMouseX = 0, lastMouseY = 0;
let mapStars = [];
let mapObjects = [];


// --- Utility Functions ---
// ... (debounce, showLoading, showError, convertIpfsUrl remain the same) ...
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

            // **UPDATED Liquid Calculation**
            const isStaked = status.daodao || status.enterprise;
            const isListed = status.bbl || status.boost;
            const isOwnedByMainDAO = status.owner === DAO_WALLET_ADDRESS;
            // Check if owner ends with any of the locked wallet suffixes
            const isOwnedByLockedDAO = status.owner ? DAO_LOCKED_WALLET_SUFFIXES.some(suffix => status.owner.endsWith(suffix)) : false;

            // Liquid is true ONLY if not owned by main DAO, not owned by locked DAO, not staked, and not listed
            mergedNft.liquid = !isOwnedByMainDAO && !isOwnedByLockedDAO && !isStaked && !isListed;
            mergedNft.owned_by_alliance_dao = isOwnedByMainDAO || isOwnedByLockedDAO; // Combined DAO ownership flag

        } else {
             // Default assumptions if no status data exists for an NFT ID found in metadata
             mergedNft.owner = null;
             mergedNft.broken = false;
             mergedNft.staked_daodao = false;
             mergedNft.staked_enterprise_legacy = false;
             mergedNft.bbl_market = false;
             mergedNft.boost_market = false;
             mergedNft.liquid = true; // Assume liquid if no status, though might be inaccurate
             mergedNft.owned_by_alliance_dao = false;
        }
        return mergedNft;
    });
};

// ... (initializeExplorer, calculateRanks, UI population functions remain the same) ...
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

        allNfts = mergeNftData(metadata, statusData); // Applies the new liquid logic

        calculateRanks();
        populateTraitFilters();
        populateInhabitantFilters();
        populatePlanetFilters();
        populateStatusFilters();
        populateTraitToggles();
        populateWalletTraitToggles();
        setupAddressFeatures();
        updateFilterCounts(allNfts); // Initial counts based on ALL NFTs
        addAllEventListeners();
        applyStateFromUrl(); // Apply URL params which might trigger filtering
        applyFiltersAndSort(); // Initial filter application based on defaults/URL
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
                // Ensure traitCounts exists for the type before calculating score
                if (traitCounts[attr.trait_type] && traitCounts[attr.trait_type][attr.value] && attr.trait_type !== 'Weather' && attr.trait_type !== 'Light') {
                    const count = traitCounts[attr.trait_type][attr.value];
                    const rarity = count / allNfts.length;
                    if (rarity > 0) { // Avoid division by zero if count somehow is 0
                         totalScore += 1 / rarity;
                    }
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
            countClass: 'inhabitant-count', initialCount: inhabitantCounts[name]?.total || 0, // Add fallback
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
            countClass: 'planet-count', initialCount: planetCounts[name]?.total || 0, // Add fallback
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
                 if (checkbox) {
                    label.addEventListener('mouseenter', (e) => showPreviewTile(e, 'Object', checkbox.value));
                    label.addEventListener('mouseleave', hidePreviewTile);
                 }
            });
        }
        return container;
    };

    filterLayoutOrder.forEach(traitType => {
        let values = Object.keys(traitCounts[traitType] || {}).sort(); // Fallback

        if (traitType === 'Rarity') {
            values.sort((a, b) => Number(b) - Number(a));
        } else if (traitType === 'Object' || traitType === 'Weather' || traitType === 'Light') {
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

    mintStatusContainer.innerHTML = '';
    const mintStatusFilter = createFilterItem({
        toggleClass: 'status-toggle-cb', key: 'mint_status', label: 'Mint Status',
        countClass: 'status-count',
        sliderClass: 'status-slider', left: 'Un-Minted', right: 'Minted'
    });
    mintStatusContainer.appendChild(mintStatusFilter);

     if (mintStatusContainer.parentElement) {
        const liquidStatusFilter = createFilterItem({
            toggleClass: 'status-toggle-cb', key: 'liquid_status', label: 'Liquid Status',
            countClass: 'status-count',
            sliderClass: 'status-slider', left: 'Liquid', right: 'Not Liquid'
        });
        const parentGrid = mintStatusContainer.closest('.grid');
         if (parentGrid) {
            parentGrid.appendChild(liquidStatusFilter);
         } else {
             mintStatusContainer.parentElement.appendChild(liquidStatusFilter);
         }
    } else {
        console.error("Could not find parent element for mint status container.");
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

// ... (Event listener definitions: handleMap*, addAllEventListeners, switchView, setupAddressFeatures remain the same) ...
const handleMapContextMenu = (e) => e.preventDefault();
const handleMapMouseDown = (e) => {
    e.preventDefault();
    if (e.button === 1 || e.ctrlKey || e.metaKey) { // Middle mouse or Ctrl/Cmd + Left Click for rotate
        isRotating = true;
        isPanning = false;
        spaceCanvas.style.cursor = 'ew-resize';
    }
    else if (e.button === 0) { // Left click for pan
        isPanning = true;
        isRotating = false;
        spaceCanvas.style.cursor = 'grabbing';
    }
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
};
const handleMapMouseUp = (e) => {
    e.preventDefault();
    isPanning = false; // Stop panning
    isRotating = false; // Stop rotating
    if (spaceCanvas) spaceCanvas.style.cursor = 'grab'; // Reset cursor only if canvas exists
};
const handleMapMouseLeave = () => {
    if (isPanning || isRotating) {
        isPanning = false;
        isRotating = false;
       if (spaceCanvas) spaceCanvas.style.cursor = 'grab';
    }
};
const handleMapMouseMove = (e) => {
     if (!spaceCanvas) return;
     const rect = spaceCanvas.getBoundingClientRect();
     if (rect.width === 0 || rect.height === 0) return;

     const mouseX = e.clientX - rect.left;
     const mouseY = e.clientY - rect.top;

     if (mouseX < 0 || mouseX > spaceCanvas.width || mouseY < 0 || mouseY > spaceCanvas.height) {
         if (isPanning || isRotating) {
             isPanning = false;
             isRotating = false;
             spaceCanvas.style.cursor = 'grab';
         }
         return;
     }

     const currentZoom = (mapZoom === 0) ? 0.0001 : mapZoom;
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
              mapRotation += (e.clientX - lastMouseX) / 300;
          }
      } else {
          // Hover detection logic
          let isAnyObjectHovered = false;
          for (let i = mapObjects.length - 1; i >= 0; i--) {
              const obj = mapObjects[i];
              if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number' || typeof obj.width !== 'number' || typeof obj.height !== 'number' || typeof obj.scale !== 'number') continue;

              const displayWidth = obj.width * obj.scale;
              const displayHeight = obj.height * obj.scale;
              const halfWidth = displayWidth / 2;
              const halfHeight = displayHeight / 2;

              const isHovered = (
                  rotatedX >= obj.x - halfWidth &&
                  rotatedX <= obj.x + halfWidth &&
                  rotatedY >= obj.y - halfHeight &&
                  rotatedY <= obj.y + halfHeight
              );

              obj.isFrozen = isHovered; // Freeze rotation on hover

              if (isHovered && (obj.address || ['daodao', 'bbl', 'boost', 'enterprise'].includes(obj.id))) {
                  isAnyObjectHovered = true;
                  break; // Found hover target
              }
          }
           if (spaceCanvas) spaceCanvas.style.cursor = isAnyObjectHovered ? 'pointer' : 'grab';
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

     const mouseBeforeZoomX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / currentZoom;
     const mouseBeforeZoomY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / currentZoom;

     let newZoom;
     if (e.deltaY < 0) {
          newZoom = Math.min(maxZoom, currentZoom * zoomFactor);
     }
     else {
          newZoom = Math.max(minZoom, currentZoom / zoomFactor);
     }
     if (newZoom <= 0) newZoom = minZoom;

     const mouseAfterZoomX = (mouseX - (spaceCanvas.width / 2 + mapOffsetX)) / newZoom;
     const mouseAfterZoomY = (mouseY - (spaceCanvas.height / 2 + mapOffsetY)) / newZoom;

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
          console.log("Clicked map object:", clickedObject);
          if (clickedObject.address) {
              showWalletExplorerModal(clickedObject.address);
          } else if (['daodao', 'bbl', 'boost', 'enterprise'].includes(clickedObject.id)) {
               showSystemLeaderboardModal(clickedObject.id);
          }
      } else {
          console.log("Clicked empty space on map.");
      }
 };
const handleMapResize = debounce(() => {
    console.log("Window resize detected, re-initializing map.");
    isMapInitialized = false;
    mapOffsetX = 0;
    mapOffsetY = 0;
    initializeStarfield();
}, 250);


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
    document.querySelectorAll('.multi-select-checkbox').forEach(el => el.addEventListener('change', handleFilterChange));

    addressDropdown.addEventListener('change', () => {
        searchAddressInput.value = addressDropdown.value;
        handleFilterChange();
    });

    walletTraitTogglesContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('wallet-trait-toggle')) {
            searchWallet();
        }
    });

    document.addEventListener('click', () => closeAllDropdowns());
    modalCloseBtn.addEventListener('click', hideNftDetails);
    nftModal.addEventListener('click', (e) => { if (e.target === nftModal) hideNftDetails(); });
    rarityExplainedBtn.addEventListener('click', () => rarityModal.classList.remove('hidden'));
    rarityModalCloseBtn.addEventListener('click', () => rarityModal.classList.add('hidden'));
    rarityModal.addEventListener('click', (e) => { if (e.target === rarityModal) rarityModal.classList.add('hidden'); });
    badgesExplainedBtn.addEventListener('click', () => badgeModal.classList.remove('hidden'));
    badgeModalCloseBtn.addEventListener('click', () => badgeModal.classList.add('hidden'));
    badgeModal.addEventListener('click', (e) => { if (e.target === badgeModal) badgeModal.classList.add('hidden'); });
    walletModalCloseBtn.addEventListener('click', hideWalletExplorerModal);
    walletExplorerModal.addEventListener('click', (e) => { if (e.target === walletExplorerModal) hideWalletExplorerModal(); });
    systemModalCloseBtn.addEventListener('click', hideSystemLeaderboardModal);
    systemLeaderboardModal.addEventListener('click', (e) => { if (e.target === systemLeaderboardModal) hideSystemLeaderboardModal(); });

    const debouncedFilterLocal = debounce(handleFilterChange, 300); // Use local debounce if needed here
    searchInput.addEventListener('input', debouncedFilterLocal);
    sortSelect.addEventListener('change', handleFilterChange);
    resetButton.addEventListener('click', resetAll);

    collectionViewBtn.addEventListener('click', () => switchView('collection'));
    walletViewBtn.addEventListener('click', () => switchView('wallet'));
    mapViewBtn.addEventListener('click', () => switchView('map'));

    walletResetBtn.addEventListener('click', () => {
        walletSearchAddressInput.value = '';
        walletGallery.innerHTML = '';
        walletGalleryTitle.textContent = 'Wallet NFTs';
         document.querySelectorAll('#leaderboard-table tbody tr.selected').forEach(row => {
            row.classList.remove('selected');
        });
        showLoading(walletGallery, 'Search for or select a wallet to see owned NFTs.');
    });

    walletSearchAddressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchWallet();
    });

    searchAddressInput.addEventListener('input', () => {
        handleAddressInput(searchAddressInput, addressSuggestions, handleFilterChange, false);
    });

    walletSearchAddressInput.addEventListener('input', () => {
        handleAddressInput(walletSearchAddressInput, walletAddressSuggestions, searchWallet, true);
    });

    leaderboardTable.addEventListener('click', (e) => {
        const headerCellSpan = e.target.closest('th > span[data-sort-by]');
        if (!headerCellSpan) return;
        const newColumn = headerCellSpan.dataset.sortBy;
        if (holderSort.column === newColumn) {
            holderSort.direction = holderSort.direction === 'desc' ? 'asc' : 'desc';
        } else {
            holderSort.column = newColumn;
            holderSort.direction = (newColumn === 'address') ? 'asc' : 'desc';
        }
        sortAndDisplayHolders();
    });

     const setupCopyButton = (buttonEl, inputEl) => {
          if (buttonEl && inputEl) {
              buttonEl.addEventListener('click', () => copyToClipboard(inputEl.value));
          }
     };
    setupCopyButton(copyAddressBtn, searchAddressInput);
    setupCopyButton(walletCopyAddressBtn, walletSearchAddressInput);

    const toggleInhabitantFiltersBtn = document.getElementById('toggle-inhabitant-filters');
    const inhabitantArrow = document.getElementById('inhabitant-arrow');
    const togglePlanetFiltersBtn = document.getElementById('toggle-planet-filters');
    const planetArrow = document.getElementById('planet-arrow');

     if (toggleInhabitantFiltersBtn && inhabitantFiltersContainer && inhabitantArrow) {
        toggleInhabitantFiltersBtn.addEventListener('click', () => {
            inhabitantFiltersContainer.classList.toggle('hidden');
            inhabitantArrow.classList.toggle('rotate-180');
        });
     }
      if (togglePlanetFiltersBtn && planetFiltersContainer && planetArrow) {
        togglePlanetFiltersBtn.addEventListener('click', () => {
            planetFiltersContainer.classList.toggle('hidden');
            planetArrow.classList.toggle('rotate-180');
        });
      }

      addMapListeners();
      window.addEventListener('resize', handleMapResize);
};

function switchView(viewName) {
     console.log("Switching view to:", viewName);
     if (viewName !== 'map' && globalAnimationFrameId) {
         console.log("Stopping map animation due to view switch.");
         cancelAnimationFrame(globalAnimationFrameId);
         globalAnimationFrameId = null;
         isMapInitialized = false; // Reset flag fully when switching away
     }

     collectionView.classList.add('hidden');
     walletView.classList.add('hidden');
     mapView.classList.add('hidden');
     collectionViewBtn.classList.remove('active');
     walletViewBtn.classList.remove('active');
     mapViewBtn.classList.remove('active');

     if (viewName === 'collection') {
         collectionView.classList.remove('hidden');
         collectionViewBtn.classList.add('active');
     } else if (viewName === 'wallet') {
         walletView.classList.remove('hidden');
         walletViewBtn.classList.add('active');
     } else if (viewName === 'map') {
         mapView.classList.remove('hidden');
         mapViewBtn.classList.add('active');
         requestAnimationFrame(() => {
             initializeStarfield(); // Initialize or restart animation
         });
     }
 }

const setupAddressFeatures = () => {
    const ownerCounts = {};
    allNfts.forEach(nft => {
        if (nft.owner) {
            ownerCounts[nft.owner] = (ownerCounts[nft.owner] || 0) + 1;
        }
    });
    const sortedOwners = Object.entries(ownerCounts)
        .sort(([, countA], [, countB]) => countB - countA);
    addressDropdown.innerHTML = '<option value="">Holders</option>';
    sortedOwners.forEach(([address, count]) => {
        const option = document.createElement('option');
        option.value = address;
        option.textContent = `(${count}) ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        addressDropdown.appendChild(option);
    });
    ownerAddresses = sortedOwners.map(([address]) => address);
};


// --- Collection View Logic ---
const applyFiltersAndSort = () => {
    let tempNfts = [...allNfts]; // Start with all NFTs

    // Apply Address Search FIRST if present
    const addressSearchTerm = searchAddressInput.value.trim().toLowerCase();
    if (addressSearchTerm) {
        tempNfts = tempNfts.filter(nft =>
            nft.owner &&
            (nft.owner.toLowerCase() === addressSearchTerm ||
            (addressSearchTerm.length < 42 && nft.owner.toLowerCase().endsWith(addressSearchTerm)))
        );
    }

    // Apply Status Filters
    // ... (logic for staked, listed, rewards remains the same) ...
     if (document.querySelector('.status-toggle-cb[data-key="staked"]')?.checked) {
        const slider = document.querySelector('.direction-slider[data-slider-key="staked"]');
        if (slider) {
            const sliderValue = slider.value;
            if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.staked_enterprise_legacy);
            else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.staked_enterprise_legacy || nft.staked_daodao);
            else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.staked_daodao);
        }
    }
    if (document.querySelector('.status-toggle-cb[data-key="listed"]')?.checked) {
        const slider = document.querySelector('.direction-slider[data-slider-key="listed"]');
         if (slider) {
            const sliderValue = slider.value;
            if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.boost_market);
            else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.boost_market || nft.bbl_market);
            else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.bbl_market);
         }
    }
    if (document.querySelector('.status-toggle-cb[data-key="rewards"]')?.checked) {
         const slider = document.querySelector('.direction-slider[data-slider-key="rewards"]');
          if (slider) {
            const sliderValue = slider.value;
            if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.broken === true);
            else if (sliderValue === '1') tempNfts = tempNfts.filter(nft => nft.broken !== undefined);
            else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.broken === false);
          }
    }
    if (document.querySelector('.status-toggle-cb[data-key="liquid_status"]')?.checked) {
        const slider = document.querySelector('.direction-slider[data-slider-key="liquid_status"]');
         if (slider) {
            const sliderValue = slider.value;
            if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.liquid === true); // Only Liquid
            // No action needed for '1' (Both) as it doesn't filter out anything
            else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.liquid === false); // Only Not Liquid
         }
    }
     if (document.querySelector('.status-toggle-cb[data-key="mint_status"]')?.checked) {
        const slider = document.querySelector('.direction-slider[data-slider-key="mint_status"]');
         if (slider) {
            const sliderValue = slider.value;
            if (sliderValue === '0') tempNfts = tempNfts.filter(nft => nft.owner === DAO_WALLET_ADDRESS); // Un-Minted
            // No action needed for '1' (Both)
            else if (sliderValue === '2') tempNfts = tempNfts.filter(nft => nft.owner !== DAO_WALLET_ADDRESS); // Minted
         }
    }


    // Apply Planet Filters
    // ... (logic remains the same) ...
    const activePlanetFilters = [];
    document.querySelectorAll('.planet-toggle-cb:checked').forEach(cb => {
        const planetName = cb.dataset.key;
        const slider = document.querySelector(`.direction-slider[data-slider-key="${planetName}"]`);
        if (slider) activePlanetFilters.push({ name: planetName, direction: slider.value });
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


    // Apply Inhabitant Filters
    // ... (logic remains the same) ...
     const activeInhabitantFilters = [];
    document.querySelectorAll('.inhabitant-toggle-cb:checked').forEach(cb => {
        const inhabitantName = cb.dataset.key;
        const slider = document.querySelector(`.gender-slider[data-slider-key="${inhabitantName}"]`);
         if (slider) activeInhabitantFilters.push({ name: inhabitantName, gender: slider.value });
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


    // Apply ID Search
    const searchTerm = searchInput.value;
    if (searchTerm) {
        tempNfts = tempNfts.filter(nft => nft.id?.toString() === searchTerm);
    }

    // Apply Multi-Select Trait Filters
    // ... (logic remains the same) ...
    document.querySelectorAll('.multi-select-container').forEach(container => {
        const traitElement = container.querySelector('[data-trait]');
        if (!traitElement) return;
        const trait = traitElement.dataset.trait;
        let selectedValues = [];
        container.querySelectorAll('.multi-select-checkbox:checked').forEach(cb => selectedValues.push(cb.value));
        if (selectedValues.length === 0) return;

        tempNfts = tempNfts.filter(nft =>
            nft.attributes?.some(attr => attr.trait_type === trait && selectedValues.includes(attr.value?.toString()))
        );
    });


    // Apply Sorting LAST
    const sortValue = sortSelect.value;
    if (sortValue === 'asc') tempNfts.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
    else if (sortValue === 'desc') tempNfts.sort((a, b) => (b.rank ?? -Infinity) - (a.rank ?? -Infinity));
    else if (sortValue === 'id') tempNfts.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    // Update global filtered list and UI
    filteredNfts = tempNfts;
    resultsCount.textContent = filteredNfts.length;
    updateFilterCounts(filteredNfts); // Update counts based on the final filtered list
    displayPage(1); // Display the first page
};


// ... (handleFilterChange, updateUrlState, applyStateFromUrl, updateMultiSelectButtonText, closeAllDropdowns, displayPage remain the same) ...
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
         if (toggle.classList.contains('status-toggle-cb') || toggle.classList.contains('planet-toggle-cb') || toggle.classList.contains('inhabitant-toggle-cb')) {
            params.set(toggle.dataset.key, 'true');
            const slider = document.querySelector(`.direction-slider[data-slider-key="${toggle.dataset.key}"]`);
            if(slider && !slider.disabled) {
                params.set(`${toggle.dataset.key}_pos`, slider.value);
            }
         }
    });

    try {
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        history.replaceState({}, '', newUrl);
    } catch (e) { console.warn("Could not update URL state.", e); }
};


const applyStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    searchInput.value = params.get('id') || '';
    searchAddressInput.value = params.get('address') || '';
    const sortParam = params.get('sort');
    sortSelect.value = [...sortSelect.options].some(opt => opt.value === sortParam) ? sortParam : 'asc';

    document.querySelectorAll('.multi-select-container').forEach(container => {
        const traitElement = container.querySelector('[data-trait]');
        if (!traitElement) return;
        const trait = traitElement.dataset.trait.toLowerCase();
        if (!params.has(trait)) return;
        const values = params.get(trait).split(',');
        container.querySelectorAll('.multi-select-checkbox').forEach(cb => {
            cb.checked = values.includes(cb.value); // Set checked based on URL
        });
        updateMultiSelectButtonText(container);
    });

    document.querySelectorAll('.toggle-checkbox').forEach(toggle => {
         if (toggle.classList.contains('status-toggle-cb') || toggle.classList.contains('planet-toggle-cb') || toggle.classList.contains('inhabitant-toggle-cb')) {
            const key = toggle.dataset.key;
            const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`);
            if (params.get(key) === 'true') {
                toggle.checked = true; // Set checked based on URL
                if(slider) {
                    slider.disabled = false;
                    slider.value = params.get(`${key}_pos`) || '1';
                }
            } else {
                 toggle.checked = false; // Ensure unchecked if not in URL
                 if (slider) slider.disabled = true; // Disable slider if toggle is off
            }
         }
    });

};

const updateMultiSelectButtonText = (container) => {
    const buttonSpan = container.querySelector('.multi-select-button span');
    const traitCheckbox = container.querySelector('.multi-select-checkbox');
    if (!buttonSpan || !traitCheckbox) return;
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
    gallery.innerHTML = '';
    if (filteredNfts.length === 0) {
        showLoading(gallery, 'No NFTs match the current filters.');
        updatePaginationControls(0);
        return;
    }
    const totalPages = Math.ceil(filteredNfts.length / itemsPerPage);
     page = Math.max(1, Math.min(page, totalPages));
     currentPage = page;

    const pageItems = filteredNfts.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    pageItems.forEach(nft => gallery.appendChild(createNftCard(nft, '.trait-toggle')));
    updatePaginationControls(totalPages);
};

// ... (createNftCard, addBadge, updatePaginationControls, resetAll remain the same) ...
const createNftCard = (nft, toggleSelector) => {
    const card = document.createElement('div');
    card.className = 'nft-card bg-gray-800 border border-gray-700 rounded-xl overflow-hidden flex flex-col';
    card.addEventListener('click', () => showNftDetails(nft));
     const imageUrl = convertIpfsUrl(nft.thumbnail_image || nft.image) || `https://placehold.co/300x300/1f2937/e5e7eb?text=No+Image`;
     const nftName = nft.name || `NFT #${nft.id || '?'}`;
     const displayTitle = nftName.replace('The AllianceDAO NFT', 'AllianceDAO NFT');

    let traitsHtml = '';
     const currentVisibleTraits = traitOrder.filter(t => {
         const toggle = document.querySelector(`${toggleSelector}[data-trait="${t}"]`);
         return toggle?.checked;
     });

    currentVisibleTraits.forEach(traitType => {
        let value = 'N/A';
        if (traitType === 'Rank' && nft.rank != null) { value = `#${nft.rank}`; } // Check for null/undefined rank
        else if (traitType === 'Rarity' && nft.rarityScore != null) { value = nft.rarityScore.toFixed(2); } // Check score
        else { value = nft.attributes?.find(attr => attr.trait_type === traitType)?.value || 'N/A'; }
        traitsHtml += `<li class="flex justify-between items-center py-2 px-1 border-b border-gray-700 last:border-b-0"><span class="text-xs font-medium text-cyan-400 uppercase">${traitType}</span><span class="text-sm font-semibold text-white truncate" title="${value}">${value}</span></li>`;
    });

    card.innerHTML = `
        <div class="image-container aspect-w-1 aspect-h-1 w-full">
            <img src="${imageUrl}" alt="${nftName}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null; this.src='https://placehold.co/300x300/1f2937/e5e7eb?text=Error'; this.alt='Image Error';">
        </div>
        <div class="p-4 flex-grow flex flex-col">
            <h2 class="text-lg font-bold text-white mb-3 truncate" title="${displayTitle}">${displayTitle}</h2>
            <ul class="text-sm flex-grow">${traitsHtml}</ul>
        </div>`;

    const imageContainer = card.querySelector('.image-container');
    if (!imageContainer) return card;

    const isDaoOwned = nft.owner === DAO_WALLET_ADDRESS || (nft.owner && DAO_LOCKED_WALLET_SUFFIXES.some(s => nft.owner.endsWith(s))); // Use combined check
    const hasBadges = nft.broken || nft.staked_daodao || nft.boost_market || nft.bbl_market || nft.staked_enterprise_legacy || isDaoOwned;

    if (hasBadges) {
        const toggleButton = document.createElement('button');
        toggleButton.className = 'top-left-toggle';
        toggleButton.title = 'Toggle badge visibility';
        toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        toggleButton.type = 'button';

        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = imageContainer.classList.toggle('badges-hidden');
            toggleButton.innerHTML = isHidden ? `...` : `...`; // Use SVG strings as before
             toggleButton.innerHTML = isHidden
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>` // Eye-off
                : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`; // Eye
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

     if (isDaoOwned) addBadge(topRightStack, 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/Alliance%20DAO%20Logo.png', 'Owned by DAO');
     if (nft.staked_daodao) addBadge(topRightStack, 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/DAODAO.png', 'Staked on DAODAO');
     if (nft.boost_market) addBadge(topRightStack, 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/Boost%20Logo.png', 'Listed on Boost');
     if (nft.bbl_market) addBadge(topRightStack, 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/BBL%20No%20Background.png', 'Listed on BBL');
     if (nft.staked_enterprise_legacy) addBadge(topRightStack, 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/Enterprise.jpg', 'Staked on Enterprise');

    if (topRightStack.children.length > 0) {
        imageContainer.appendChild(topRightStack);
    }

    return card;
};

function addBadge(container, src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.title = alt;
    img.className = 'overlay-icon';
    container.appendChild(img);
}

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
        if (toggle.classList.contains('status-toggle-cb') || toggle.classList.contains('planet-toggle-cb') || toggle.classList.contains('inhabitant-toggle-cb')) {
            toggle.checked = false;
            const key = toggle.dataset.key;
            const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`);
            if (slider) {
                slider.value = 1;
                slider.disabled = true;
            }
        }
    });

    document.querySelectorAll('.multi-select-container').forEach(container => {
        container.querySelectorAll('.multi-select-checkbox').forEach(cb => cb.checked = false);
        updateMultiSelectButtonText(container);
    });

    document.querySelectorAll('.trait-toggle').forEach(toggle => {
         toggle.checked = defaultTraitsOn.includes(toggle.dataset.trait);
     });

    handleFilterChange();
};


// This function updates the counts displayed next to the filters.
// It receives the list of NFTs *currently matching* the active filters.
const updateFilterCounts = (currentFilteredNfts) => {
    const newCounts = {}; // Counts for multi-select traits within the filtered set
    const currentInhabitantCounts = {}; // Counts for inhabitants within the filtered set
    const currentPlanetCounts = {}; // Counts for planets within the filtered set

    // Calculate specific counts based *only* on the filtered list provided
    currentFilteredNfts.forEach(nft => {
        if (nft.attributes) {
            nft.attributes.forEach(attr => {
                // Multi-select trait counts
                if (!newCounts[attr.trait_type]) newCounts[attr.trait_type] = {};
                newCounts[attr.trait_type][attr.value] = (newCounts[attr.trait_type][attr.value] || 0) + 1;

                // Inhabitant counts
                if (attr.trait_type === 'Inhabitant') {
                     const baseName = attr.value.replace(/ (M|F)$/, '');
                     if (!currentInhabitantCounts[baseName]) currentInhabitantCounts[baseName] = { total: 0, male: 0, female: 0 };
                     currentInhabitantCounts[baseName].total++;
                     if (attr.value.endsWith(' M')) currentInhabitantCounts[baseName].male++;
                     if (attr.value.endsWith(' F')) currentInhabitantCounts[baseName].female++;
                }
                // Planet counts
                if (attr.trait_type === 'Planet') {
                     const baseName = attr.value.replace(/ (North|South)$/, '');
                     if (!currentPlanetCounts[baseName]) currentPlanetCounts[baseName] = { total: 0, north: 0, south: 0 };
                     currentPlanetCounts[baseName].total++;
                     if (attr.value.endsWith(' North')) currentPlanetCounts[baseName].north++;
                     if (attr.value.endsWith(' South')) currentPlanetCounts[baseName].south++;
                }
            });
        }
    });

    // Update Multi-Select Trait Filter Counts & Disabled State
    // ... (logic remains the same, uses newCounts) ...
     document.querySelectorAll('.multi-select-container').forEach(container => {
        const traitType = container.querySelector('[data-trait]')?.dataset.trait;
         if (!traitType) return;
        container.querySelectorAll('label').forEach(label => {
            const checkbox = label.querySelector('input');
            if (!checkbox) return;
            const value = checkbox.value;
            const countSpan = label.querySelector('.trait-count');
            const count = newCounts[traitType]?.[value] || 0; // Use count from filtered set
            if (countSpan) countSpan.textContent = count;
            if (count === 0 && !checkbox.checked) {
                label.style.opacity = '0.5'; label.style.cursor = 'not-allowed'; checkbox.disabled = true;
            } else {
                label.style.opacity = '1'; label.style.cursor = 'pointer'; checkbox.disabled = false;
            }
        });
    });


    // Update Inhabitant Filter Counts
    // ... (logic remains the same, uses currentInhabitantCounts) ...
    document.querySelectorAll('.inhabitant-count').forEach(countSpan => {
        const name = countSpan.dataset.countKey;
        const slider = document.querySelector(`.gender-slider[data-slider-key="${name}"]`);
        const counts = currentInhabitantCounts[name] || { male: 0, female: 0 };
        if (slider) {
            if (slider.value === '0') countSpan.textContent = counts.male;
            else if (slider.value === '1') countSpan.textContent = counts.male + counts.female;
            else if (slider.value === '2') countSpan.textContent = counts.female;
        } else { countSpan.textContent = counts.male + counts.female; }
    });


    // Update Planet Filter Counts
    // ... (logic remains the same, uses currentPlanetCounts) ...
     document.querySelectorAll('.planet-count').forEach(countSpan => {
        const name = countSpan.dataset.countKey;
        const slider = document.querySelector(`.direction-slider[data-slider-key="${name}"]`);
        const counts = currentPlanetCounts[name] || { north: 0, south: 0 };
         if (slider) {
            if (slider.value === '0') countSpan.textContent = counts.north;
            else if (slider.value === '1') countSpan.textContent = counts.north + counts.south;
            else if (slider.value === '2') countSpan.textContent = counts.south;
         } else { countSpan.textContent = counts.north + counts.south; }
    });


    // Update Status Filter Counts (Based on currentFilteredNfts)
    document.querySelectorAll('.status-count').forEach(countSpan => {
        const key = countSpan.dataset.countKey;
        const slider = document.querySelector(`.direction-slider[data-slider-key="${key}"]`);
        if (!slider) return;

        let count = 0;
        const listToCount = currentFilteredNfts; // Count within the filtered list

        // Calculate counts based *only* on the listToCount
        if (key === 'staked') {
            const enterpriseCount = listToCount.filter(n => n.staked_enterprise_legacy).length;
            const daodaoCount = listToCount.filter(n => n.staked_daodao).length;
            if (slider.value === '0') count = enterpriseCount;
            else if (slider.value === '1') count = listToCount.filter(n => n.staked_enterprise_legacy || n.staked_daodao).length;
            else if (slider.value === '2') count = daodaoCount;
        } else if (key === 'listed') {
            const boostCount = listToCount.filter(n => n.boost_market).length;
            const bblCount = listToCount.filter(n => n.bbl_market).length;
            if (slider.value === '0') count = boostCount;
            else if (slider.value === '1') count = listToCount.filter(n => n.boost_market || n.bbl_market).length;
            else if (slider.value === '2') count = bblCount;
        } else if (key === 'rewards') {
            const brokenCount = listToCount.filter(n => n.broken === true).length;
            const unbrokenCount = listToCount.filter(n => n.broken === false).length;
            if (slider.value === '0') count = brokenCount;
            else if (slider.value === '1') count = brokenCount + unbrokenCount; // Total that have a defined broken status
            else if (slider.value === '2') count = unbrokenCount;
        } else if (key === 'liquid_status') {
            // Use the recalculated 'liquid' property
            const liquidCount = listToCount.filter(n => n.liquid === true).length;
            const notLiquidCount = listToCount.filter(n => n.liquid === false).length;
            if (slider.value === '0') count = liquidCount;        // Count matching Liquid
            else if (slider.value === '1') count = listToCount.length; // Count ALL items in the filtered list
            else if (slider.value === '2') count = notLiquidCount; // Count matching Not Liquid
        } else if (key === 'mint_status') {
            const unmintedCount = listToCount.filter(n => n.owner === DAO_WALLET_ADDRESS).length;
            const mintedCount = listToCount.filter(n => n.owner !== DAO_WALLET_ADDRESS).length;
            if (slider.value === '0') count = unmintedCount;
            else if (slider.value === '1') count = listToCount.length; // Count ALL items in the filtered list
            else if (slider.value === '2') count = mintedCount;
        }
        countSpan.textContent = count;
    });
};


// ... (Modal/Preview functions remain the same: findHighestRaritySample, showPreviewTile, hidePreviewTile, showCopyToast, copyToClipboard, showNftDetails, hideNftDetails, findRarestTrait, generateShareImage) ...
const findHighestRaritySample = (filterFn) => {
     const matchingNfts = allNfts.filter(filterFn);
     if (matchingNfts.length === 0) return null;
     matchingNfts.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
     return matchingNfts[0];
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
         const sliderElement = event.currentTarget.querySelector('input[type="range"].direction-slider, input[type="range"].gender-slider');
         const sliderValue = sliderElement ? sliderElement.value : '1';

        if (sliderValue === '1') {
            const suffix1 = traitType === 'Inhabitant' ? ' M' : ' North';
            const suffix2 = traitType === 'Inhabitant' ? ' F' : ' South';
            sample1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suffix1));
            sample2 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suffix2));
             if (!sample1 && !sample2) sample1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value.startsWith(value)));
             else if (!sample1) sample1 = sample2;
        } else {
            const suffix = (traitType === 'Inhabitant' ? (sliderValue === '0' ? ' M' : ' F') : (sliderValue === '0' ? ' North' : ' South'));
            sample1 = findHighestRaritySample(nft => nft.attributes?.some(a => a.trait_type === traitType && a.value === value + suffix));
        }
    }
     if (sample1) {
         image1.src = convertIpfsUrl(sample1.thumbnail_image || sample1.image) || `https://placehold.co/128x128/1f2937/e5e7eb?text=N/A`;
         name1.textContent = sample1.attributes?.find(a => a.trait_type === traitType)?.value || value;
         container1.classList.remove('hidden');
     } else {
         container1.classList.add('hidden'); image1.src = ''; name1.textContent = '';
     }
     if (sample2) {
         image2.src = convertIpfsUrl(sample2.thumbnail_image || sample2.image) || `https://placehold.co/128x128/1f2937/e5e7eb?text=N/A`;
         name2.textContent = sample2.attributes?.find(a => a.trait_type === traitType)?.value || value;
         container2.classList.remove('hidden');
     } else {
         container2.classList.add('hidden'); image2.src = ''; name2.textContent = '';
     }

    if (sample1 || sample2) {
        const tileWidth = sample2 ? 330 : 160;
        let x = event.clientX + 20;
        let y = event.clientY + 10;
        if (x + tileWidth > window.innerWidth) { x = event.clientX - tileWidth - 20; }
         if (y + previewTile.offsetHeight > window.innerHeight) { y = window.innerHeight - previewTile.offsetHeight - 10; }
         if (x < 0) x = 10; if (y < 0) y = 10;
        previewTile.style.left = `${x}px`;
        previewTile.style.top = `${y}px`;
        previewTile.classList.remove('hidden');
    } else { hidePreviewTile(); }
};

const hidePreviewTile = () => document.getElementById('preview-tile').classList.add('hidden');

const showCopyToast = (text) => {
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
        console.error('Failed to copy text: ', err);
         try { // Fallback
             const tempInput = document.createElement('input'); tempInput.value = textToCopy;
             document.body.appendChild(tempInput); tempInput.select(); document.execCommand('copy');
             document.body.removeChild(tempInput);
             const shortText = textToCopy.length > 10 ? `${textToCopy.substring(0, 5)}...${textToCopy.substring(textToCopy.length - 5)}` : textToCopy;
             showCopyToast(`Copied ${typeName}: ${shortText}`);
         } catch (execErr) { console.error('Fallback copy failed: ', execErr); showCopyToast(`Failed to copy!`); }
    });
};

const showNftDetails = (nft) => {
     document.getElementById('modal-image').src = convertIpfsUrl(nft.image) || `https://placehold.co/400x400/1f2937/e5e7eb?text=No+Image`;
    document.getElementById('modal-title').textContent = (nft.name || `NFT #${nft.id || '?'}`).replace('The AllianceDAO NFT', 'AllianceDAO NFT');
    let traitsHtml = `<div class="flex justify-between text-sm"><span class="text-gray-400">Rank:</span><span class="font-semibold text-white">#${nft.rank || 'N/A'}</span></div>`;
     if (nft.rarityScore) { traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Rarity Score:</span><span class="font-semibold text-white">${nft.rarityScore.toFixed(2)}</span></div>`; }
     const displayAttributes = (nft.attributes || []).filter(attr => traitOrder.includes(attr.trait_type) && !['Rank', 'Rarity'].includes(attr.trait_type)).sort((a, b) => traitOrder.indexOf(a.trait_type) - traitOrder.indexOf(b.trait_type));
    traitsHtml += displayAttributes.map(attr => `<div class="flex justify-between text-sm"><span class="text-gray-400">${attr.trait_type}:</span><span class="font-semibold text-white truncate" title="${attr.value}">${attr.value || 'N/A'}</span></div>`).join('');
    traitsHtml += `<div class="pt-2 mt-2 border-t border-gray-600"></div>`;
    const isStaked = nft.staked_daodao || nft.staked_enterprise_legacy;
    const isListed = nft.bbl_market || nft.boost_market;
    let statusText = 'Unknown';
    if (nft.owner === DAO_WALLET_ADDRESS || (nft.owner && DAO_LOCKED_WALLET_SUFFIXES.some(s=>nft.owner.endsWith(s)))) { statusText = 'DAO Owned'; } // Combined DAO check
    else if (nft.liquid === true) { statusText = 'Liquid (In Wallet)'; }
    else if (isStaked) { statusText = `Staked (${nft.staked_daodao ? 'DAODAO' : 'Enterprise'})`; }
    else if (isListed) { statusText = `Listed (${nft.bbl_market ? 'BBL' : 'Boost'})`; }
    else if (nft.liquid === false) { statusText = 'In Wallet (Not Liquid)'; }
    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Status:</span><span class="font-semibold text-white">${statusText}</span></div>`;
    traitsHtml += `<div class="flex justify-between text-sm"><span class="text-gray-400">Broken:</span><span class="font-semibold text-white">${nft.broken ? 'Yes' : 'No'}</span></div>`;
    traitsHtml += `<div class="pt-2 mt-2 border-t border-gray-600"></div>`;
    traitsHtml += `<div class="flex justify-between text-sm items-center"><span class="text-gray-400">Owner:</span><span class="owner-address font-mono text-sm font-semibold text-white truncate cursor-pointer" title="Click to copy">${nft.owner || 'N/A'}</span></div>`;
    const modalTraits = document.getElementById('modal-traits');
    modalTraits.innerHTML = traitsHtml;
    const ownerAddressEl = modalTraits.querySelector('.owner-address');
    if (nft.owner && ownerAddressEl) { ownerAddressEl.addEventListener('click', () => copyToClipboard(nft.owner, 'Owner Address')); }
    else if (ownerAddressEl) { ownerAddressEl.style.cursor = 'default'; ownerAddressEl.removeAttribute('title'); }
    document.getElementById('modal-link').href = convertIpfsUrl(nft.image);
    const downloadBtn = document.getElementById('download-post-btn');
    downloadBtn.textContent = 'Download Post';
    downloadBtn.onclick = () => generateShareImage(nft, downloadBtn);
    nftModal.classList.remove('hidden');
};

const hideNftDetails = () => nftModal.classList.add('hidden');

const findRarestTrait = (nft) => {
     if (!nft.attributes || !traitCounts) return { value: 'N/A', trait_type: 'Unknown' };
    let rarestTrait = null; let minCount = Infinity;
    nft.attributes.forEach(attr => {
         if (traitCounts[attr.trait_type] && traitCounts[attr.trait_type][attr.value] && attr.trait_type !== 'Weather' && attr.trait_type !== 'Light') {
             const count = traitCounts[attr.trait_type][attr.value];
             if (count < minCount) { minCount = count; rarestTrait = attr; }
         }
    });
    return rarestTrait || { value: 'N/A', trait_type: 'Unknown' };
};

const generateShareImage = (nft, button) => {
    button.textContent = 'Generating...'; button.disabled = true;
    const canvas = document.getElementById('share-canvas'); const ctx = canvas.getContext('2d');
    const img = new Image(); img.crossOrigin = "anonymous";
    const imageUrl = convertIpfsUrl(nft.image) || convertIpfsUrl(nft.thumbnail_image) || null;
     if (!imageUrl) { console.error("No valid image URL for NFT:", nft.id); button.textContent = 'No Image'; setTimeout(() => { button.textContent = 'Download Post'; button.disabled = false; }, 2000); return; }
    img.src = imageUrl;
    img.onload = () => {
        canvas.width = 1080; canvas.height = 1080; ctx.clearRect(0, 0, canvas.width, canvas.height);
        try { ctx.drawImage(img, 0, 0, 1080, 1080); } catch (drawError) { console.error("Error drawing NFT image:", drawError); button.textContent = 'Draw Error'; setTimeout(() => { button.textContent = 'Download Post'; button.disabled = false; }, 2000); return; }
        ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; ctx.lineWidth = 8; ctx.font = 'bold 48px Inter, sans-serif'; ctx.lineJoin = 'round'; const margin = 40;
         const drawTextWithOutline = (text, x, y, align = 'left') => { ctx.textAlign = align; ctx.strokeText(text, x, y); ctx.fillText(text, x, y); };
        drawTextWithOutline(`NFT #${nft.id || '?'}`, margin, margin + 48, 'left');
        drawTextWithOutline(`Rank #${nft.rank || 'N/A'}`, canvas.width - margin, margin + 48, 'right');
        const planet = nft.attributes?.find(a => a.trait_type === 'Planet')?.value || 'N/A';
        drawTextWithOutline(planet, margin, canvas.height - margin, 'left');
        let inhabitantText = nft.attributes?.find(a => a.trait_type === 'Inhabitant')?.value || 'N/A';
        if (inhabitantText.endsWith(' M')) inhabitantText = inhabitantText.replace(' M', ' Male'); else if (inhabitantText.endsWith(' F')) inhabitantText = inhabitantText.replace(' F', ' Female');
        drawTextWithOutline(inhabitantText, canvas.width - margin, canvas.height - margin, 'right');
        const bannerHeight = 120; const bannerY = canvas.height - bannerHeight - 80;
        if (nft.broken) {
            ctx.fillStyle = 'rgba(220, 38, 38, 0.85)'; ctx.fillRect(0, bannerY, canvas.width, bannerHeight);
            ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = 'bold 60px Inter, sans-serif';
            drawTextWithOutline('BROKEN', canvas.width / 2, bannerY + 85, 'center');
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, bannerY, canvas.width, bannerHeight);
            const strength = findRarestTrait(nft);
            ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = 'bold 40px Inter, sans-serif';
            drawTextWithOutline(`Rarest: ${strength.value || 'N/A'}`, canvas.width / 2, bannerY + 75, 'center');
        }
        try {
            const link = document.createElement('a'); link.download = `AllianceDAO_NFT_${nft.id || 'Unknown'}.png`; link.href = canvas.toDataURL('image/png'); link.click();
            button.textContent = 'Downloaded!';
        } catch (downloadError) { console.error("Error triggering download:", downloadError); button.textContent = 'Download Failed'; }
        setTimeout(() => { button.textContent = 'Download Post'; button.disabled = false; }, 2000);
    };
    img.onerror = (err) => { console.error("Could not load image. URL:", imageUrl, "Error:", err); button.textContent = 'Image Load Error'; setTimeout(() => { button.textContent = 'Download Post'; button.disabled = false; }, 3000); }
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
            // Use the UPDATED liquid property calculated in mergeNftData
            if (nft.liquid) stats.liquid++;
            if (nft.staked_daodao) stats.daodaoStaked++;
            if (nft.staked_enterprise_legacy) stats.enterpriseStaked++;
            if (nft.bbl_market) stats.bblListed++;
            if (nft.boost_market) stats.boostListed++;
            if (nft.broken) stats.broken++;
            else stats.unbroken++;
        }
    });
    allHolderStats = Object.values(ownerStats);
    sortAndDisplayHolders(); // Initial sort uses default: total desc
};


// ... (sortAndDisplayHolders, displayHolderPage, updateHolderPaginationControls remain the same) ...
const sortAndDisplayHolders = () => {
     const { column, direction } = holderSort;
     const sortedStats = [...allHolderStats].sort((a, b) => {
        const valA = a[column]; const valB = b[column];
        const numA = (typeof valA === 'number') ? valA : -Infinity;
        const numB = (typeof valB === 'number') ? valB : -Infinity;
        if (column === 'address') { return direction === 'asc' ? (valA || '').localeCompare(valB || '') : (valB || '').localeCompare(valA || ''); }
        else { return direction === 'asc' ? numA - numB : numB - numA; }
    });
     allHolderStats = sortedStats;
    displayHolderPage(1);
};

const displayHolderPage = (page) => {
    holderCurrentPage = page;
    leaderboardTable.innerHTML = '';
    const table = document.createElement('table'); const thead = document.createElement('thead'); const tbody = document.createElement('tbody'); const headerRow = document.createElement('tr');
    const createHeaderCell = (label, columnKey) => { /* ... creates sortable header ... */
        const th = document.createElement('th'); const span = document.createElement('span'); span.dataset.sortBy = columnKey;
        const isSortCol = holderSort.column === columnKey; const ascActive = isSortCol && holderSort.direction === 'asc'; const descActive = isSortCol && holderSort.direction === 'desc';
        if (isSortCol) span.classList.add('sort-active');
        span.innerHTML = `${label}<svg class="sort-icon w-4 h-4 inline-block ${ascActive ? 'active' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg><svg class="sort-icon w-4 h-4 inline-block ${descActive ? 'active' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
        th.appendChild(span); return th;
     };
    const headerData = [ { label: 'Rank' }, { label: 'Holder', key: 'address' }, { label: 'Liquid', key: 'liquid' }, { label: 'DAODAO', key: 'daodaoStaked' }, { label: 'Enterprise', key: 'enterpriseStaked' }, { label: 'Broken', key: 'broken' }, { label: 'Unbroken', key: 'unbroken' }, { label: 'BBL Listed', key: 'bblListed' }, { label: 'Boost Listed', key: 'boostListed' }, { label: 'Total', key: 'total' } ];
    headerData.forEach(h => { if (h.key) { headerRow.appendChild(createHeaderCell(h.label, h.key)); } else { const th = document.createElement('th'); th.textContent = h.label; headerRow.appendChild(th); } });
    thead.appendChild(headerRow); table.appendChild(thead);
    const pageItems = allHolderStats.slice((page - 1) * holdersPerPage, page * holdersPerPage);
    pageItems.forEach(({ address, ...stats }, index) => { /* ... creates table row ... */
        const itemRow = document.createElement('tr'); itemRow.className = 'leaderboard-row-item'; itemRow.dataset.address = address;
        const rank = (page - 1) * holdersPerPage + index + 1; const shortAddress = address ? `terra...${address.substring(address.length - 4)}` : 'N/A';
        const createCell = (value, classes = [], title = '') => { const cell = document.createElement('td'); cell.textContent = value ?? '0'; if (classes.length > 0) cell.classList.add(...classes); if (title) cell.title = title; return cell; };
        itemRow.appendChild(createCell(`#${rank}`, ['font-bold']));
        itemRow.appendChild(createCell(shortAddress, ['font-mono', 'text-sm'], address));
        itemRow.appendChild(createCell(stats.liquid)); // Uses correct liquid count
        itemRow.appendChild(createCell(stats.daodaoStaked, stats.daodaoStaked > 0 ? ['text-cyan-400'] : []));
        itemRow.appendChild(createCell(stats.enterpriseStaked, stats.enterpriseStaked > 0 ? ['text-gray-400'] : []));
        itemRow.appendChild(createCell(stats.broken, stats.broken > 0 ? ['text-red-400'] : []));
        itemRow.appendChild(createCell(stats.unbroken, stats.unbroken > 0 ? ['text-green-400'] : []));
        itemRow.appendChild(createCell(stats.bblListed, stats.bblListed > 0 ? ['text-green-400'] : []));
        itemRow.appendChild(createCell(stats.boostListed, stats.boostListed > 0 ? ['text-purple-400'] : []));
        itemRow.appendChild(createCell(stats.total, ['font-bold']));
        itemRow.addEventListener('click', () => { if (address) { walletSearchAddressInput.value = address; searchWallet(); document.querySelectorAll('#leaderboard-table tbody tr.selected').forEach(row => row.classList.remove('selected')); itemRow.classList.add('selected'); } });
        tbody.appendChild(itemRow);
     });
    table.appendChild(tbody); leaderboardTable.appendChild(table);
    updateHolderPaginationControls();
};

const updateHolderPaginationControls = () => {
     leaderboardPagination.innerHTML = ''; const totalPages = Math.ceil(allHolderStats.length / holdersPerPage); if (totalPages <= 1) return;
     const prevButton = document.createElement('button'); prevButton.textContent = 'Previous'; prevButton.className = 'pagination-btn'; prevButton.disabled = holderCurrentPage === 1; prevButton.onclick = () => displayHolderPage(holderCurrentPage - 1); leaderboardPagination.appendChild(prevButton);
     const pageInfo = document.createElement('span'); pageInfo.className = 'text-gray-400'; pageInfo.textContent = `Page ${holderCurrentPage} of ${totalPages}`; leaderboardPagination.appendChild(pageInfo);
     const nextButton = document.createElement('button'); nextButton.textContent = 'Next'; nextButton.className = 'pagination-btn'; nextButton.disabled = holderCurrentPage === totalPages; nextButton.onclick = () => displayHolderPage(holderCurrentPage + 1); leaderboardPagination.appendChild(nextButton);
};


// ... (Map View Logic: addMapListeners, removeMapListeners, initializeStarfield, handleMap*, showWalletExplorerModal, hideWalletExplorerModal, showSystemLeaderboardModal, displaySystemLeaderboardPage, hideSystemLeaderboardModal remain the same) ...
let mapListenersAdded = false;

function addMapListeners() {
    if (mapListenersAdded || !spaceCanvas) return;
    console.log("Adding map listeners.");
    spaceCanvas.addEventListener('contextmenu', handleMapContextMenu);
    spaceCanvas.addEventListener('mousedown', handleMapMouseDown);
    window.addEventListener('mouseup', handleMapMouseUp);
    spaceCanvas.addEventListener('mouseleave', handleMapMouseLeave);
    spaceCanvas.addEventListener('mousemove', handleMapMouseMove);
    spaceCanvas.addEventListener('wheel', handleMapWheel, { passive: false });
    spaceCanvas.addEventListener('click', handleMapClick);
    mapListenersAdded = true;
}

function removeMapListeners() {
     if (!mapListenersAdded || !spaceCanvas) return;
     console.log("Removing map listeners.");
     spaceCanvas.removeEventListener('contextmenu', handleMapContextMenu);
     spaceCanvas.removeEventListener('mousedown', handleMapMouseDown);
     window.removeEventListener('mouseup', handleMapMouseUp);
     spaceCanvas.removeEventListener('mouseleave', handleMapMouseLeave);
     spaceCanvas.removeEventListener('mousemove', handleMapMouseMove);
     spaceCanvas.removeEventListener('wheel', handleMapWheel, { passive: false });
     spaceCanvas.removeEventListener('click', handleMapClick);
     mapListenersAdded = false;
 }

 const initializeStarfield = () => {
     if (!spaceCanvas) { console.error("Space canvas element not found!"); return; }
      if (isMapInitialized && globalAnimationFrameId) { console.log("Map already initialized and running."); return; }
      if (isMapInitialized && !globalAnimationFrameId) { console.log("Restarting map animation frame."); animate(); return; }
      console.log("Initializing starfield...");
      const ctx = spaceCanvas.getContext('2d');
      if (!ctx) { console.error("Could not get 2D context for space canvas."); return; }
     mapStars = []; mapObjects = []; mapZoom = 0.15; mapRotation = 0; mapOffsetX = 0; mapOffsetY = 0;
     isPanning = false; isRotating = false; lastMouseX = 0; lastMouseY = 0;
     const minZoom = 0.1, maxZoom = 5;

     function setCanvasSize() { /* ... sets canvas width/height ... */
         const displayWidth = spaceCanvas.clientWidth; const displayHeight = spaceCanvas.clientHeight;
         if (spaceCanvas.width !== displayWidth || spaceCanvas.height !== displayHeight) { spaceCanvas.width = displayWidth; spaceCanvas.height = displayHeight; console.log(`Canvas resized to: ${spaceCanvas.width}x${spaceCanvas.height}`); return true; } return false;
      }
     function createStars() { /* ... creates stars based on canvas size ... */
         mapStars = []; const width = spaceCanvas.width; const height = spaceCanvas.height; if (width === 0 || height === 0) { console.warn("Skipping star creation: Canvas dimensions zero."); return; }
         const starCount = (width * height * 4) / 1000; console.log(`Creating ${Math.round(starCount)} stars.`);
         for (let i = 0; i < starCount; i++) { mapStars.push({ x: (Math.random() - 0.5) * width * 10, y: (Math.random() - 0.5) * height * 10, radius: Math.random() * 1.5 + 0.5, alpha: Math.random(), twinkleSpeed: Math.random() * 0.03 + 0.005, twinkleDirection: 1 }); }
     }
     function drawGalaxy() { /* ... draws stars, lines, objects, text ... */
         if (!ctx || !spaceCanvas) return; ctx.save(); ctx.clearRect(0, 0, spaceCanvas.width, spaceCanvas.height); if (spaceCanvas.width === 0 || spaceCanvas.height === 0) { ctx.restore(); console.warn("Skipping drawGalaxy: Canvas dimensions zero."); return; }
         ctx.translate(spaceCanvas.width / 2 + mapOffsetX, spaceCanvas.height / 2 + mapOffsetY); ctx.scale(mapZoom, mapZoom); ctx.rotate(mapRotation);
         mapStars.forEach(star => { ctx.beginPath(); ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`; ctx.fill(); });
         const systemLineColors = { daodao: 'rgba(56, 189, 248, 0.7)', bbl: 'rgba(16, 185, 129, 0.7)', boost: 'rgba(168, 85, 247, 0.7)', enterprise: 'rgba(56, 189, 248, 0.7)' };
         mapObjects.forEach(obj => { if (obj.lineTargetId) { /* ... draw lines ... */
             const target = mapObjects.find(t => t.id === obj.lineTargetId); if(target){ /* ... line drawing logic ... */
                ctx.beginPath(); ctx.moveTo(obj.x, obj.y);
                 if (obj.lineTargetId === 'enterprise') { const angle = Math.atan2(obj.y - target.y, obj.x - target.x); const targetWidth = (typeof target.width === 'number' && target.width > 0) ? target.width : 100; const targetScale = (typeof target.scale === 'number' && target.scale > 0) ? target.scale : 0.1; const edgeRadius = (targetWidth * targetScale / 2) * 0.45; ctx.lineTo(target.x + Math.cos(angle) * edgeRadius, target.y + Math.sin(angle) * edgeRadius); }
                 else if (obj.id.startsWith('satellite')) { ctx.lineTo(target.x, target.y); const mothership = mapObjects.find(m => m.id === `mothership_${obj.system}_${obj.address}`); if(mothership) ctx.lineTo(mothership.x, mothership.y); }
                 else { ctx.lineTo(target.x, target.y); }
                 ctx.strokeStyle = systemLineColors[obj.system] || 'rgba(150, 150, 150, 0.5)'; ctx.lineWidth = 2 / mapZoom; ctx.stroke();
             }
         }});
         mapObjects.forEach(obj => { if (!obj.img || !obj.img.complete || !(obj.width > 0) || !(obj.height > 0)) return; let displayWidth = obj.width * obj.scale; let displayHeight = obj.height * obj.scale; ctx.save(); ctx.translate(obj.x, obj.y); ctx.rotate(obj.rotation || 0); try { ctx.drawImage(obj.img, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight); } catch (e) { console.error("Error drawing image:", obj.id, e); } ctx.restore(); if(obj.textAbove || obj.textBelow) { /* ... draw text ... */
             ctx.save(); ctx.translate(obj.x, obj.y); ctx.rotate(-mapRotation); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; const textScale = 1 / mapZoom;
             if (obj.textAbove) { ctx.font = `bold ${18 * textScale}px Inter`; ctx.fillText(obj.textAbove, 0, -displayHeight / 2 - (10 * textScale)); }
             if (obj.textBelow) { ctx.font = `${16 * textScale}px Inter`; ctx.fillStyle = '#9ca3af'; ctx.fillText(obj.textBelow, 0, displayHeight / 2 + (20 * textScale)); } ctx.restore();
          }});
         ctx.restore();
     }
     function updateStars() { /* ... updates star alpha ... */
          mapStars.forEach(star => { star.alpha += star.twinkleSpeed * star.twinkleDirection; if (star.alpha > 1 || star.alpha < 0) { star.alpha = Math.max(0, Math.min(1, star.alpha)); star.twinkleDirection *= -1; } });
     }
     function updateObjectRotations() { /* ... updates object rotation ... */
          mapObjects.forEach(obj => { if (obj.rotationSpeed && !obj.isFrozen) { obj.rotation = (obj.rotation || 0) + obj.rotationSpeed; } });
     }
     function animate() { /* ... animation loop ... */
         if (!isMapInitialized || !spaceCanvas || !document.body.contains(spaceCanvas) || mapView.classList.contains('hidden')) { console.log("Stopping animation loop."); if (globalAnimationFrameId) { cancelAnimationFrame(globalAnimationFrameId); globalAnimationFrameId = null; } return; }
         setCanvasSize(); updateStars(); updateObjectRotations(); drawGalaxy(); globalAnimationFrameId = requestAnimationFrame(animate);
     }
     function addMapObject(config, preloadedImages) { /* ... adds object to mapObjects ... */
         const img = preloadedImages[config.imageId]; if (!img) { console.error(`Image ID ${config.imageId} not preloaded.`); return; } if (!img.width || !img.height) { console.warn(`Image ${config.imageId} zero dimensions.`); return; }
         mapObjects.push({ ...config, img: img, width: img.width, height: img.height, isFrozen: false, rotation: config.rotation || 0 });
     }
     function initMap() { /* ... loads images, builds systems, starts animation ... */
         console.log("Running initMap function..."); if (globalAnimationFrameId) { cancelAnimationFrame(globalAnimationFrameId); globalAnimationFrameId = null; } if (!spaceCanvas) { console.error("Cannot initMap: Canvas not found."); return; }
         setCanvasSize(); if (spaceCanvas.width === 0 || spaceCanvas.height === 0) { console.error("Canvas dimensions zero in initMap. Aborting."); return; }
         mapObjects = []; createStars();
         const imageAssets = { daodao: '...', bbl: '...', boost: '...', enterprise: '...', allianceLogo: '...', terra: '...' }; // URLs as before
          imageAssets.daodao= 'https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/daodao-planet.png'; imageAssets.bbl='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/bbl-planet.png'; imageAssets.boost='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/boost-ship.png'; imageAssets.enterprise='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/enterprise-blackhole.png'; imageAssets.allianceLogo='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Files/main/aDAO%20Logo%20No%20Background.png'; imageAssets.terra='https://raw.githubusercontent.com/defipatriot/aDAO-Image-Planets-Empty/main/Terra.PNG';
         const imagePromises = Object.entries(imageAssets).map(([id, url]) => new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { if (img.width === 0 || img.height === 0) console.warn(`Image loaded zero dimensions: ${id}`); resolve({ id, img }); }; img.onerror = (err) => { console.error(`Failed to load image: ${id} from ${url}`, err); reject(new Error(`Failed to load ${id}`)); }; img.src = url; }));
         Promise.all(imagePromises).then(loadedImageArray => { const preloadedImages = loadedImageArray.reduce((acc, { id, img }) => { acc[id] = img; return acc; }, {}); setCanvasSize(); if (spaceCanvas.width === 0 || spaceCanvas.height === 0) { console.error("Canvas dimensions zero after image load. Aborting."); isMapInitialized = false; return; } buildGalaxySystems(preloadedImages); isMapInitialized = true; console.log("Map initialization successful. Starting animation."); animate(); }).catch(error => { console.error("Error loading map images:", error); if (mapView && !mapView.classList.contains('hidden')) { showError(mapView, `Could not load map assets. Error: ${error.message}`); } isMapInitialized = false; });
     }
     function buildGalaxySystems(preloadedImages) { /* ... calculates positions and adds systems/ships ... */
         const width = spaceCanvas.width; const height = spaceCanvas.height; if (width === 0 || height === 0) { console.error("Cannot build galaxy, canvas dimensions zero."); return; }
         const systemCenters = { daodao: { x: 0, y: -height * 2 }, bbl: { x: -width * 2, y: 0 }, boost: { x: width * 2, y: 0 }, enterprise: { x: 0, y: height * 2 } };
         addMapObject({ id: 'terra', imageId: 'terra', type: 'planet', x: 0, y: 0, scale: 0.25, rotation: 0 }, preloadedImages);
         const addSystemCenter = (id, imageId, type, scale, spin) => { addMapObject({ id: id, imageId: imageId, type: type, x: systemCenters[id].x, y: systemCenters[id].y, scale: scale, rotation: 0, rotationSpeed: spin ? (Math.random() - 0.5) * 0.002 : 0 }, preloadedImages); };
         const bblCount = allNfts.filter(n=>n.bbl_market).length; const boostCount = allNfts.filter(n=>n.boost_market).length; const enterpriseCount = allNfts.filter(n=>n.staked_enterprise_legacy).length;
         addSystemCenter('daodao', 'daodao', 'planet', 0.5, true); addSystemCenter('bbl', 'bbl', 'planet', bblCount > 0 ? (bblCount / 59) * 0.5 : 0.1, true); addSystemCenter('boost', 'boost', 'ship_main', boostCount > 0 ? (boostCount / 59) * 0.5 : 0.1, true); addSystemCenter('enterprise', 'enterprise', 'blackhole', enterpriseCount > 0 ? (enterpriseCount / 515) * 0.5 : 0.1, true);
         const holderStats = {}; allNfts.forEach(nft => { if (nft.owner) { if (!holderStats[nft.owner]) holderStats[nft.owner] = { total: 0, daodaoStaked: 0, bblListed: 0, boostListed: 0, enterpriseStaked: 0 }; const stats = holderStats[nft.owner]; stats.total++; if (nft.staked_daodao) stats.daodaoStaked++; if (nft.bbl_market) stats.bblListed++; if (nft.boost_market) stats.boostListed++; if (nft.staked_enterprise_legacy) stats.enterpriseStaked++; } });
         const createFleetSystem = (systemId, statKey) => { /* ... adds motherships/satellites ... */
             const center = systemCenters[systemId]; const topHolders = Object.entries(holderStats).filter(([, stats]) => stats[statKey] > 0).sort(([, a], [, b]) => b[statKey] - a[statKey]).slice(0, 10).map(([address, stats]) => ({ address, ...stats })); if (topHolders.length === 0) return;
             const countList = topHolders.map(s => s[statKey]); const minCount = countList.length > 0 ? Math.min(...countList) : 1; const maxCount = countList.length > 0 ? Math.max(...countList) : 1; const countRange = maxCount > minCount ? maxCount - minCount : 1; const minScale = 0.1, maxScale = 0.3, scaleRange = maxScale - minScale; const currentWidth = spaceCanvas.width, currentHeight = spaceCanvas.height; const minRadius = Math.min(currentWidth, currentHeight) * 0.6; const maxRadius = Math.min(currentWidth, currentHeight) * 1.5; const radiusRange = maxRadius - minRadius; const angleStep = (2 * Math.PI) / topHolders.length;
             topHolders.forEach((stats, index) => { const { address, total } = stats; const platformCount = stats[statKey]; const angle = angleStep * index; const normalizedSize = countRange === 1 ? 0 : (platformCount - minCount) / countRange; const distance = minRadius + (normalizedSize * radiusRange); const scale = minScale + (normalizedSize * scaleRange); const last4 = address.slice(-4); const mothershipX = center.x + Math.cos(angle) * distance; const mothershipY = center.y + Math.sin(angle) * distance; addMapObject({ id: `mothership_${systemId}_${address}`, imageId: 'allianceLogo', type: 'ship', address: address, system: systemId, lineTargetId: `satellite_${systemId}_${address}`, x: mothershipX, y: mothershipY, scale: scale, textAbove: `${total - platformCount}`, textBelow: last4 }, preloadedImages); addMapObject({ id: `satellite_${systemId}_${address}`, imageId: 'allianceLogo', type: 'ship', address: address, system: systemId, lineTargetId: systemId, x: (mothershipX + center.x) / 2, y: (mothershipY + center.y) / 2, scale: scale * 0.8, textAbove: `${platformCount}`, textBelow: last4 }, preloadedImages); });
          };
         const createEnterpriseSystem = () => { /* ... adds enterprise ships ... */
              const currentWidth = spaceCanvas.width, currentHeight = spaceCanvas.height; if (currentWidth === 0 || currentHeight === 0) return; const center = systemCenters.enterprise; const statKey = 'enterpriseStaked';
              const topStakers = Object.entries(holderStats).filter(([, stats]) => stats.enterpriseStaked > 0).sort(([, a], [, b]) => b.enterpriseStaked - a.enterpriseStaked).slice(0, 10).map(([address, stats]) => ({ address, ...stats })); if (topStakers.length === 0) return;
              const countList = topStakers.map(s => s.enterpriseStaked); const minCount = Math.min(...countList); const maxCount = Math.max(...countList); const countRange = maxCount > minCount ? maxCount - minCount : 1; const minScale = 0.1, maxScale = 0.3, scaleRange = maxScale - minScale; const minRadius = Math.min(currentWidth, currentHeight) * 0.6; const maxRadius = Math.min(currentWidth, currentHeight) * 1.2; const radiusRange = maxRadius - minRadius; const angleStep = (2 * Math.PI) / topStakers.length;
              topStakers.forEach((stats, index) => { const { address, enterpriseStaked } = stats; const angle = angleStep * index; const normalizedSize = countRange === 1 ? 0 : (enterpriseStaked - minCount) / countRange; const distance = minRadius + (normalizedSize * radiusRange); const scale = minScale + (normalizedSize * scaleRange); addMapObject({ id: `ship_enterprise_${address}`, imageId: 'allianceLogo', type: 'ship', address: address, system: 'enterprise', lineTargetId: 'enterprise', x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance, scale: scale, textAbove: `${enterpriseStaked}`, textBelow: address.slice(-4) }, preloadedImages); });
         };
         createFleetSystem('daodao', 'daodaoStaked'); createFleetSystem('bbl', 'bblListed'); createFleetSystem('boost', 'boostListed'); createEnterpriseSystem(); console.log("Galaxy systems built.");
     }
     initMap(); // Start the map initialization
 };


// --- Reusable Address Search Handler ---
const debouncedFilter = debounce(handleFilterChange, 300);

const handleAddressInput = (inputEl, suggestionsEl, onSelectCallback, isWallet) => {
    const input = inputEl.value.toLowerCase();
     const reversedSearchTerm = input.split('').reverse().join(''); // Search from the end
    suggestionsEl.innerHTML = '';

    if (!input) {
        suggestionsEl.classList.add('hidden');
        if (!isWallet) debouncedFilter(); // Trigger filter update only for collection view
        return;
    }

    let matches = ownerAddresses.filter(addr => addr.toLowerCase().endsWith(reversedSearchTerm));
    const sortIndex = reversedSearchTerm.length;
     matches.sort((a, b) => {
         const charA = a.charAt(a.length - 1 - sortIndex) || '';
         const charB = b.charAt(b.length - 1 - sortIndex) || '';
         return charA.localeCompare(charB);
     });

    if (matches.length > 0) {
        matches.slice(0, 10).forEach(match => {
            const item = document.createElement('div');
            item.className = 'address-suggestion-item';
            const startIndex = match.length - reversedSearchTerm.length;
            item.innerHTML = `${match.substring(0, startIndex)}<strong class="text-cyan-400">${match.substring(startIndex)}</strong>`;
            item.style.direction = 'ltr'; item.style.textAlign = 'left';
            item.onclick = () => {
                 inputEl.value = match; // Set full address on click
                suggestionsEl.classList.add('hidden');
                onSelectCallback(); // Trigger appropriate action (filter or wallet search)
            };
            suggestionsEl.appendChild(item);
        });
        if (matches.length > 10) {
            const item = document.createElement('div'); item.className = 'address-suggestion-item text-gray-400';
            item.textContent = `${matches.length - 10} more... Keep typing`; suggestionsEl.appendChild(item);
        }
        suggestionsEl.classList.remove('hidden');
    } else {
        suggestionsEl.classList.add('hidden');
    }

    if (!isWallet) { debouncedFilter(); } // Trigger filter only for collection view input
};


// ... (showWalletExplorerModal, hideWalletExplorerModal, showSystemLeaderboardModal, displaySystemLeaderboardPage, hideSystemLeaderboardModal, searchWallet remain the same) ...
const showWalletExplorerModal = (address) => {
     const walletNfts = allNfts.filter(nft => nft.owner === address); if (walletNfts.length === 0) return;
     const titleEl = document.getElementById('wallet-modal-title'); const statsEl = document.getElementById('wallet-modal-stats'); const galleryEl = document.getElementById('wallet-modal-gallery');
     if (!titleEl || !statsEl || !galleryEl) return;
     titleEl.textContent = address; statsEl.innerHTML = ''; galleryEl.innerHTML = '';
     const daodaoStaked = walletNfts.filter(n => n.staked_daodao).length; const enterpriseStaked = walletNfts.filter(n => n.staked_enterprise_legacy).length; const boostListed = walletNfts.filter(n => n.boost_market).length; const bblListed = walletNfts.filter(n => n.bbl_market).length; const broken = walletNfts.filter(n => n.broken).length; const total = walletNfts.length; const unbroken = total - broken; const liquid = walletNfts.filter(n => n.liquid).length;
     const stats = [ { label: 'Total NFTs', value: total, color: 'text-white' }, { label: 'Liquid', value: liquid, color: 'text-white' }, { label: 'DAODAO Staked', value: daodaoStaked, color: 'text-cyan-400' }, { label: 'Enterprise Staked', value: enterpriseStaked, color: 'text-gray-400' }, { label: 'Boost Listed', value: boostListed, color: 'text-purple-400' }, { label: 'BBL Listed', value: bblListed, color: 'text-green-400' }, { label: 'Unbroken', value: unbroken, color: 'text-green-400' }, { label: 'Broken', value: broken, color: 'text-red-400' }, ];
     stats.forEach(stat => { statsEl.innerHTML += `<div class="text-center"><div class="text-xs text-gray-400 uppercase tracking-wider">${stat.label}</div><div class="text-2xl font-bold ${stat.color}">${stat.value}</div></div>`; });
     walletNfts.sort((a,b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).forEach(nft => { galleryEl.appendChild(createNftCard(nft, '.wallet-trait-toggle')); });
     walletExplorerModal.classList.remove('hidden');
};
const hideWalletExplorerModal = () => walletExplorerModal.classList.add('hidden');

const showSystemLeaderboardModal = (systemId) => {
     const systemKeyMap = { daodao: 'daodaoStaked', bbl: 'bblListed', boost: 'boostListed', enterprise: 'enterpriseStaked' }; const systemNameMap = { daodao: 'DAODAO Staking', bbl: 'BackBone Labs Listings', boost: 'Boost Marketplace Listings', enterprise: 'Enterprise Staking' }; const statKey = systemKeyMap[systemId]; if (!statKey) return;
     const leaderboardData = Object.values(allHolderStats).filter(stats => stats[statKey] > 0).sort((a, b) => b[statKey] - a[statKey]);
     const titleEl = document.getElementById('system-modal-title'); const disclaimerEl = document.getElementById('system-modal-disclaimer'); if (!titleEl || !disclaimerEl) return;
     titleEl.textContent = `${systemNameMap[systemId]} Leaderboard`;
     if (systemId === 'boost') { disclaimerEl.innerHTML = `<strong>Note:</strong> Addresses listed here may belong to the Boost contract...`; disclaimerEl.classList.remove('hidden'); } else { disclaimerEl.classList.add('hidden'); }
     displaySystemLeaderboardPage(leaderboardData, statKey, 1); systemLeaderboardModal.classList.remove('hidden');
};
const displaySystemLeaderboardPage = (data, statKey, page) => {
     const tableEl = document.getElementById('system-modal-table'); const paginationEl = document.getElementById('system-modal-pagination'); if (!tableEl || !paginationEl) return;
     const itemsPerPage = 10; tableEl.innerHTML = ''; paginationEl.innerHTML = '';
     const pageData = data.slice((page - 1) * itemsPerPage, page * itemsPerPage);
     let tableHtml = `<div class="leaderboard-header" style="grid-template-columns: 1fr 4fr 1fr;"><span>Rank</span><span class="text-left">Address</span><span class="text-center">Amount</span></div>`;
     pageData.forEach((stats, index) => { const rank = (page - 1) * itemsPerPage + index + 1; tableHtml += `<div class="leaderboard-row" style="grid-template-columns: 1fr 4fr 1fr;"><span class="text-center font-bold">#${rank}</span><span class="font-mono text-sm truncate" title="${stats.address}">${stats.address}</span><span class="text-center font-bold">${stats[statKey] ?? 0}</span></div>`; });
     tableEl.innerHTML = tableHtml;
     const totalPages = Math.ceil(data.length / itemsPerPage); if (totalPages > 1) { /* ... pagination buttons ... */
        const prevBtn = document.createElement('button'); prevBtn.textContent = 'Previous'; prevBtn.className = 'pagination-btn'; prevBtn.disabled = page === 1; prevBtn.onclick = () => displaySystemLeaderboardPage(data, statKey, page - 1); paginationEl.appendChild(prevBtn);
        const pageInfo = document.createElement('span'); pageInfo.className = 'text-gray-400'; pageInfo.textContent = `Page ${page} of ${totalPages}`; paginationEl.appendChild(pageInfo);
        const nextBtn = document.createElement('button'); nextBtn.textContent = 'Next'; nextBtn.className = 'pagination-btn'; nextBtn.disabled = page === totalPages; nextBtn.onclick = () => displaySystemLeaderboardPage(data, statKey, page + 1); paginationEl.appendChild(nextBtn);
      }
};
const hideSystemLeaderboardModal = () => systemLeaderboardModal.classList.add('hidden');

const searchWallet = () => {
     const address = walletSearchAddressInput.value.trim(); walletAddressSuggestions.classList.add('hidden');
     document.querySelectorAll('#leaderboard-table tbody tr').forEach(row => { row.classList.toggle('selected', row.dataset.address === address); });
     if (!address) { showError(walletGallery, 'Please enter or select a wallet address.'); walletGalleryTitle.textContent = 'Wallet NFTs'; return; }
     const walletNfts = allNfts.filter(nft => nft.owner === address); walletGalleryTitle.textContent = `Found ${walletNfts.length} NFTs for wallet:`; walletGallery.innerHTML = ''; if (walletNfts.length === 0) { showLoading(walletGallery, 'No NFTs found for this address.'); return; }
     walletNfts.sort((a,b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).forEach(nft => { walletGallery.appendChild(createNftCard(nft, '.wallet-trait-toggle')); });
};


// --- Initialize Application ---
initializeExplorer();

