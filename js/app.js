/* app.js
   Core logic:
   - Renders cards & favorites
   - Filter/search
   - Favorites (localStorage)
   - Map (Chennai-centered) with interactive markers
*/

(function () {
    // DOM refs
    const cardGrid = document.getElementById('cardGrid');
    const favListEl = document.getElementById('favList');
    const searchInput = document.getElementById('searchInput');
    const vegFilter = document.getElementById('vegFilter');
    const priceFilter = document.getElementById('priceFilter');
    const ratingFilter = document.getElementById('ratingFilter');
    const resetBtn = document.getElementById('resetBtn');
    // const copyBtn = document.getElementById('copyJson');
    const clearFavsBtn = document.getElementById('clearFavs');
    // const darkToggle = document.getElementById('darkToggle');

    // State
    let favorites = JSON.parse(localStorage.getItem('scout:favs') || '[]');
    let filtered = PLACES.slice();
    let map;
    let markers = {};

    // Helpers
    const escapeHtml = (s) =>
        (s + '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[c]));

    function saveFavs() {
        localStorage.setItem('scout:favs', JSON.stringify(favorites));
    }
    function isFav(id) {
        return favorites.includes(id);
    }
    function toggleFav(id) {
        if (isFav(id)) favorites = favorites.filter((x) => x !== id);
        else favorites = [id, ...favorites];
        saveFavs();
        renderAll();
    }
    function clearFavs() {
        favorites = [];
        saveFavs();
        renderAll();
    }

    // Map setup
    function initMap() {
        map = L.map('map', { zoomControl: true }).setView([13.0827, 80.2707], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        // markers
        PLACES.forEach((p) => {
            const m = L.marker([p.lat, p.lng]).addTo(map);
            m.bindPopup(
                `<strong>${escapeHtml(p.name)}</strong><br/><span style="font-size:12px;color:#666">${escapeHtml(
                    p.tags.join(' • ')
                )}</span>`
            );
            m.on('click', () => {
                highlightCard(p.id);
                scrollToCard(p.id);
            });
            markers[p.id] = m;
        });
    }

    // Cards
    function renderGrid(list) {
        cardGrid.innerHTML = '';
        if (!list.length) {
            cardGrid.innerHTML =
                '<div class="panel small-muted" style="padding:14px">No results — try adjusting filters.</div>';
            return;
        }
        list.forEach((p) => {
            const el = document.createElement('article');
            el.className = 'card';
            el.dataset.id = p.id;
            el.innerHTML = `
        <div class="card-media">
          <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy"/>
          <button class="fav-btn" data-fav>${isFav(p.id) ? '❤' : '♡'}</button>
        </div>
        <div class="card-body">
          <div class="card-title">
            <h4>${escapeHtml(p.name)}</h4>
            <div class="price-tier">${'$'.repeat(p.priceTier)}</div>
          </div>
          <div class="card-desc">${escapeHtml(p.description)}</div>
          <div class="card-meta">
            <div class="badges">
              ${p.tags
                .slice(0, 3)
                .map((t) => `<span class="badge">${escapeHtml(t)}</span>`)
                .join('')}
            </div>
            <div class="small-muted">⭐ ${p.rating} • ${escapeHtml(p.hours)}</div>
          </div>
        </div>
      `;

            // Fav toggle
            el.querySelector('[data-fav]').addEventListener('click', (ev) => {
                ev.stopPropagation();
                toggleFav(p.id);
            });

            // Hover → popup + fly
            el.addEventListener('mouseenter', () => {
                if (map && markers[p.id]) {
                    markers[p.id].openPopup();
                    map.flyTo([p.lat, p.lng], 14, { duration: 0.4 });
                }
            });

            // Click → focus
            el.addEventListener('click', () => {
                highlightCard(p.id);
                scrollToCard(p.id);
                if (map && markers[p.id]) {
                    markers[p.id].openPopup();
                    map.flyTo([p.lat, p.lng], 15, { duration: 0.5 });
                }
            });

            cardGrid.appendChild(el);
        });
    }

    // Favorites
    function renderFavs() {
        favListEl.innerHTML = '';
        if (!favorites.length) {
            favListEl.innerHTML =
                '<li class="small-muted">No favorites yet — click the ❤ on a card.</li>';
            return;
        }
        favorites.forEach((id) => {
            const p = PLACES.find((x) => x.id === id);
            if (!p) return;
            const li = document.createElement('li');
            li.className = 'fav-item';
            li.innerHTML = `
        <div class="meta">
          <img src="${p.image}" alt="${escapeHtml(p.name)}"/>
          <div>
            <div style="font-weight:700">${escapeHtml(p.name)}</div>
            <div class="small-muted">${escapeHtml(p.tags.join(' • '))}</div>
          </div>
        </div>
        <div>
          <button class="btn small remove">Remove</button>
        </div>
      `;
            li.querySelector('.remove').addEventListener('click', (ev) => {
                ev.stopPropagation();
                toggleFav(id);
            });
            li.addEventListener('click', () => {
                highlightCard(id);
                scrollToCard(id);
                if (map && markers[id])
                    map.flyTo([p.lat, p.lng], 15, { duration: 0.5 });
            });
            favListEl.appendChild(li);
        });
    }

    // Highlight
    function highlightCard(id) {
        document.querySelectorAll('.card').forEach((c) => (c.style.boxShadow = ''));
        const el = document.querySelector(`.card[data-id="${id}"]`);
        if (el) {
            el.style.boxShadow = '0 20px 40px rgba(0,0,0,0.25)';
            el.animate(
                [{ transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }],
                { duration: 250 }
            );
        }
    }

    function scrollToCard(id) {
        const el = document.querySelector(`.card[data-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Filters
    function applyFilters() {
        const q = (searchInput.value || '').trim().toLowerCase();
        const veg = vegFilter.value;
        const price = priceFilter.value;
        const minRating = Number(ratingFilter.value || 0);

        filtered = PLACES.filter((p) => {
            if (veg === 'veg' && !p.veg) return false;
            if (veg === 'nonveg' && p.veg) return false;
            if (price !== 'any' && +p.priceTier !== +price) return false;
            if (p.rating < minRating) return false;
            if (q) {
                const hay = (p.name + ' ' + p.description + ' ' + p.tags.join(' ')).toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        renderGrid(filtered);
    }

    // debounce
    function debounce(fn, wait = 220) {
        let t;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    // Event listeners
    searchInput.addEventListener('input', debounce(applyFilters, 200));
    vegFilter.addEventListener('change', applyFilters);
    priceFilter.addEventListener('change', applyFilters);
    ratingFilter.addEventListener('change', applyFilters);

    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        vegFilter.value = 'all';
        priceFilter.value = 'any';
        ratingFilter.value = '0';
        applyFilters();
    });


    clearFavsBtn.addEventListener('click', () => {
        if (confirm('Clear all favorites?')) clearFavs();
    });


    // Initial render
    function renderAll() {
        applyFilters();
        renderFavs();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initMap();
        renderAll();
    });
})();
