// ... (existing code before handleAddressInput) ...

// --- Reusable Address Search Handler ---
const debouncedFilter = debounce(handleFilterChange, 300);

const handleAddressInput = (inputEl, suggestionsEl, onSelectCallback, isWallet) => {
    const input = inputEl.value.toLowerCase();
    const reversedSearchTerm = input.split('').reverse().join('');
    suggestionsEl.innerHTML = '';

    // Determine the correct list of addresses to search within
    // For Collection view suggestions, use the dynamically updated filtered list
    // For Wallet view suggestions, or if the filtered list is empty, use the master list
    const sourceList = (!isWallet && currentFilteredOwnerAddresses.length > 0)
        ? currentFilteredOwnerAddresses
        : ownerAddresses;

    if (!input) {
        suggestionsEl.classList.add('hidden');
        // Trigger filter update only for collection view when input is cleared
        if (!isWallet && searchAddressInput.value === '') {
             // Check if the current dropdown value is also empty. If so, applyFiltersAndSort
             // to potentially remove an address filter if one was selected via dropdown previously.
             // If a dropdown value IS selected, don't trigger filter, let the dropdown control it.
            if (addressDropdown.value === '') {
                debouncedFilter();
            }
        }
        return;
    }

    // Filter the relevant source list
    let matches = sourceList.filter(addr => addr.toLowerCase().endsWith(reversedSearchTerm));

    // Sort matches based on the character *before* the matched part
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
            // Display the full address, highlighting the matched part at the end
            item.innerHTML = `${match.substring(0, startIndex)}<strong class="text-cyan-400">${match.substring(startIndex)}</strong>`;
            item.style.direction = 'ltr';
            item.style.textAlign = 'left';
            item.onclick = () => {
                 inputEl.value = match; // Set the full, correct address
                suggestionsEl.classList.add('hidden');
                onSelectCallback(); // Trigger filter/search
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

    // Trigger filter update for collection view ONLY when typing
    if (!isWallet) {
        debouncedFilter();
    }
};


// ... (rest of the existing code) ...

