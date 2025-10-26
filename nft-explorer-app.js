// ... (existing code before updateAddressFeatures) ...

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

    // --- DEBUG LOGS ---
    console.log(`updateAddressFeatures: Processing ${nftList.length} NFTs.`);
    console.log(`updateAddressFeatures: Found ${sortedOwners.length} unique owners in the filtered list.`);
    if (sortedOwners.length > 0) {
        console.log(`updateAddressFeatures: Top owner in filtered list: ${sortedOwners[0][0]}, Count: ${sortedOwners[0][1]}`);
    }
    // --- END DEBUG LOGS ---

    // Update the state variable for live suggestions
    currentFilteredOwnerAddresses = sortedOwners.map(([address]) => address);

    // --- Update Dropdown ---
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
    // set the dropdown back to the default "Holders" option.
    if (!newSelectionFound && currentSelectedAddress !== '') {
         addressDropdown.value = ''; // Set dropdown back to default "Holders"
    }
};


// ... (existing code in applyFiltersAndSort, before the call to updateAddressFeatures) ...

    filteredNfts = tempNfts; // Update the global state
    resultsCount.textContent = filteredNfts.length;

    // --- DEBUG LOG ---
    console.log(`applyFiltersAndSort: Final filteredNfts length before updateAddressFeatures: ${filteredNfts.length}`);
    // --- END DEBUG LOG ---

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


// ... (rest of the code) ...

