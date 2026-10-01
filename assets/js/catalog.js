/* ========================================
   NORD HOME — CATALOG
   Логика страницы каталога: фильтрация,
   сортировка, пагинация, избранное, корзина.
   Чистый ES2020, без библиотек.

   Скрипт полностью инкапсулирован в IIFE и
   не создаёт глобальных переменных, поэтому
   не конфликтует с assets/js/script.js.

   Общие с script.js контракты:
   - localStorage: nordHomeCart, nordHomeFavorites
   - ID товара: data-id на .catalog__item
   - избранное: .is-active + aria-pressed
   - корзина: .is-added на кнопке
   - счётчик: .header__cart-count

   Избранное и корзина НЕ дублируются:
   скрипт читает то же хранилище и только
   синхронизирует визуальное состояние,
   слушатели остаются за script.js.
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* ========================================
       1. DOM
       ======================================== */

    const list = document.querySelector('.catalog__list');
    const content = document.querySelector('.catalog__content');
    const pagination = document.querySelector('.catalog__pagination');
    const countValue = document.querySelector('.catalog__count-value');
    const countText = document.querySelector('.catalog__count');
    const sortSelect = document.querySelector('#catalog-sort');
    const filterForm = document.querySelector('.catalog__filters-form');
    const resetButton = document.querySelector('.catalog__filter-reset');
    const categoryLinks = document.querySelectorAll('.catalog__filter-link');
    const colorLinks = document.querySelectorAll('.catalog__filter-color');
    const filtersToggle = document.querySelector('.catalog__filters-toggle');
    const filtersToggleLabel = document.querySelector('.catalog__filters-toggle-label');
    const filtersPanel = document.querySelector('.catalog__filters');

    /* Без каталога скрипт просто завершает работу */
    if (!list || !content) {
        return;
    }

    const priceMinInput = document.querySelector('#catalog-price-min');
    const priceMaxInput = document.querySelector('#catalog-price-max');
    const materialBoxes = document.querySelectorAll('.catalog__filter-checkbox[name="material[]"]');
    const shippingBox = document.querySelector('.catalog__filter-checkbox[name="free-shipping"]');

    /* ========================================
       2. КОНСТАНТЫ И СОСТОЯНИЕ
       ======================================== */

    const STORAGE_CART = 'nordHomeCart';
    const STORAGE_FAVORITES = 'nordHomeFavorites';
    const PER_PAGE = 6;
    const DEFAULT_SORT = 'popular';

    /** Ссылка на товар из .product-card__link */
    function getUrl(card) {
        const link = card.querySelector('.product-card__link');
        return link ? link.getAttribute('href') || '' : '';
    }

    /** Цена в виде числа: «4 990 ₽» → 4990 */
    function getProductPrice(card) {
        const priceEl = card.querySelector('.product-card__price');
        if (!priceEl) {
            return 0;
        }

        const digits = priceEl.textContent.replace(/[^\d]/g, '');

        return digits ? Number(digits) : 0;
    }

    /** Считывает карточку один раз и кеширует в dataset-объекте */
    function readProduct(item) {
        const card = item.querySelector('.product-card');

        if (!card) {
            return null;
        }

        const id = item.getAttribute('data-id');
        const link = card.querySelector('.product-card__link');
        const titleEl = card.querySelector('.product-card__title');
        const image = card.querySelector('.product-card__image');

        return {
            item,
            id: id || getUrl(card) || card.textContent.trim(),
            url: getUrl(card),
            title: link
                ? link.textContent.trim()
                : (titleEl ? titleEl.textContent.trim() : ''),
            image: image ? image.getAttribute('src') || '' : '',
            price: getProductPrice(card),
            category: item.getAttribute('data-category') || '',
            material: item.getAttribute('data-material') || '',
            color: item.getAttribute('data-color') || '',
            isNew: item.getAttribute('data-new') === 'true',
            isPopular: item.getAttribute('data-popular') === 'true',
            freeShipping: item.getAttribute('data-free-shipping') === 'true',
            order: Number(item.getAttribute('data-order')) || 0
        };
    }

    /** Состояние каталога — единственный источник правды для UI */
    const state = {
        category: 'all',
        min: '',
        max: '',
        materials: [],
        colors: [],
        freeShipping: false,
        sort: DEFAULT_SORT,
        page: 1
    };

    /** Товары в исходном порядке — для стабильной сортировки */
    let allProducts = [];

    /** Товары, прошедшие фильтрацию (без учёта страницы) */
    let visibleProducts = [];

    let emptyState = null;

    /* ========================================
       3. РАБОТА С ТОВАРАМИ
       ======================================== */

    function getProducts() {
        const items = list.querySelectorAll('.catalog__item');
        const products = [];

        items.forEach((item, index) => {
            const product = readProduct(item);

            if (product) {
                product.order = index;
                products.push(product);
            }
        });

        return products;
    }

    /* ========================================
       4. СОСТОЯНИЕ ИЗ localStorage
       ======================================== */

    function readStorage(key, fallback) {
        try {
            const raw = window.localStorage.getItem(key);

            if (!raw) {
                return fallback;
            }

            const parsed = JSON.parse(raw);

            return Array.isArray(parsed) ? parsed : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function getFavorites() {
        return readStorage(STORAGE_FAVORITES, []).filter((id) => typeof id === 'string');
    }

    function getCart() {
        return readStorage(STORAGE_CART, []).filter((item) => item && typeof item.id === 'string');
    }

    function getCartTotal(cart) {
        return cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }

    /* ========================================
       5. СЧЁТЧИК ТОВАРОВ
       ======================================== */

    /** Правильное склонение: 1 товар, 2 товара, 5 товаров */
    function getProductWord(count) {
        const lastTwo = count % 100;
        const last = count % 10;

        if (lastTwo >= 11 && lastTwo <= 14) {
            return 'товаров';
        }

        if (last === 1) {
            return 'товар';
        }

        if (last >= 2 && last <= 4) {
            return 'товара';
        }

        return 'товаров';
    }

    function updateProductCount(count) {
        if (countValue) {
            countValue.textContent = String(count);
        }

        if (countText) {
            countText.textContent = 'Найдено ' + count + ' ' + getProductWord(count);
        }
    }

    /* ========================================
       6. ФИЛЬТРАЦИЯ
       Категория AND цена AND материал AND
       цвет AND доставка. Внутри группы
       материалов и цветов — OR.
       ======================================== */

    function matchesCategory(product) {
        return state.category === 'all' || product.category === state.category;
    }

    function matchesPrice(product) {
        const min = state.min === '' ? null : Number(state.min);
        const max = state.max === '' ? null : Number(state.max);

        if (min !== null && !Number.isNaN(min) && product.price < min) {
            return false;
        }

        if (max !== null && !Number.isNaN(max) && product.price > max) {
            return false;
        }

        return true;
    }

    function matchesMaterial(product) {
        if (state.materials.length === 0) {
            return true;
        }

        return state.materials.indexOf(product.material) !== -1;
    }

    function matchesColor(product) {
        if (state.colors.length === 0) {
            return true;
        }

        return state.colors.indexOf(product.color) !== -1;
    }

    function matchesShipping(product) {
        return state.freeShipping ? product.freeShipping : true;
    }

    function applyFilters() {
        visibleProducts = allProducts.filter((product) =>
            matchesCategory(product) &&
            matchesPrice(product) &&
            matchesMaterial(product) &&
            matchesColor(product) &&
            matchesShipping(product)
        );
    }

    /* ========================================
       7. СОРТИРОВКА
       Работает по уже отфильтрованному списку.
       ======================================== */

    function sortProducts(products) {
        const sorted = products.slice();

        switch (state.sort) {
            case 'price-asc':
                sorted.sort((a, b) => a.price - b.price || a.order - b.order);
                break;

            case 'price-desc':
                sorted.sort((a, b) => b.price - a.price || a.order - b.order);
                break;

            case 'name':
                sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
                break;

            case 'new':
                sorted.sort((a, b) => (b.isNew - a.isNew) || (b.order - a.order));
                break;

            case 'popular':
            default:
                sorted.sort((a, b) => (b.isPopular - a.isPopular) || (b.order - a.order));
                break;
        }

        return sorted;
    }

    /* ========================================
       8. РЕНДЕР
       Карточки не пересоздаются — JS только
       переставляет и скрывает существующие
       элементы списка.
       ======================================== */

    function renderProducts() {
        const sorted = sortProducts(visibleProducts);

        sorted.forEach((product) => list.appendChild(product.item));

        const totalPages = Math.max(Math.ceil(sorted.length / PER_PAGE), 1);

        if (state.page > totalPages) {
            state.page = 1;
        }

        const start = (state.page - 1) * PER_PAGE;
        const pageProducts = sorted.slice(start, start + PER_PAGE);

        const pageIds = pageProducts.map((product) => product.id);

        allProducts.forEach((product) => {
            const onPage = pageIds.indexOf(product.id) !== -1;

            product.item.hidden = !onPage;
            product.item.setAttribute('aria-hidden', onPage ? 'false' : 'true');
        });

        toggleEmptyState(sorted.length === 0);
        updateProductCount(sorted.length);
        updatePagination(sorted.length);
    }

    /* ========================================
       9. ПАГИНАЦИЯ
       ======================================== */

    function createPaginationLink(page, label, isActive) {
        const item = document.createElement('li');
        item.className = 'catalog__pagination-item';

        const link = document.createElement('a');
        link.className = 'catalog__pagination-link';
        link.href = 'catalog.html?page=' + page;
        link.textContent = label;

        if (isActive) {
            link.classList.add('catalog__pagination-link--active');
            link.setAttribute('aria-current', 'page');
        } else {
            link.setAttribute('aria-label', 'Страница ' + page);
        }

        item.appendChild(link);

        return item;
    }

    function updatePagination(total) {
        if (!pagination) {
            return;
        }

        const pagesCount = Math.ceil(total / PER_PAGE);

        if (pagesCount <= 1) {
            pagination.hidden = true;

            return;
        }

        pagination.hidden = false;

        const listEl = pagination.querySelector('.catalog__pagination-list');

        if (!listEl) {
            return;
        }

        listEl.textContent = '';

        const prev = createPaginationLink(
            Math.max(state.page - 1, 1),
            '←',
            false
        );
        prev.querySelector('a').setAttribute('aria-label', 'Предыдущая страница');
        prev.querySelector('a').classList.add('catalog__pagination-link--arrow');
        listEl.appendChild(prev);

        for (let page = 1; page <= pagesCount; page += 1) {
            listEl.appendChild(createPaginationLink(page, String(page), page === state.page));
        }

        const next = createPaginationLink(
            Math.min(state.page + 1, pagesCount),
            '→',
            false
        );
        next.querySelector('a').setAttribute('aria-label', 'Следующая страница');
        next.querySelector('a').classList.add('catalog__pagination-link--arrow');
        listEl.appendChild(next);
    }

    function handlePaginationClick(event) {
        const link = event.target.closest('.catalog__pagination-link');

        if (!link || !pagination.contains(link)) {
            return;
        }

        event.preventDefault();

        const target = link.getAttribute('href') || '';
        const match = target.match(/page=(\d+)/);
        const page = match ? Number(match[1]) : 1;

        if (page === state.page) {
            return;
        }

        state.page = page;

        renderProducts();
        updateUrl();
        syncFavoriteStates();

        content.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'start'
        });
    }

    /* ========================================
       10. СОСТОЯНИЕ «НИЧЕГО НЕ НАЙДЕНО»
       ======================================== */

    function createEmptyState() {
        const wrapper = document.createElement('div');
        wrapper.className = 'catalog__empty';

        const title = document.createElement('p');
        title.className = 'catalog__empty-title';
        title.textContent = 'Ничего не найдено';

        const text = document.createElement('p');
        text.className = 'catalog__empty-text';
        text.textContent = 'Попробуйте изменить параметры фильтрации.';

        const button = document.createElement('button');
        button.className = 'catalog__empty-button';
        button.type = 'button';
        button.textContent = 'Сбросить фильтры';

        button.addEventListener('click', () => {
            resetFilters();
        });

        wrapper.appendChild(title);
        wrapper.appendChild(text);
        wrapper.appendChild(button);

        return wrapper;
    }

    function toggleEmptyState(isEmpty) {
        if (isEmpty && !emptyState) {
            emptyState = createEmptyState();
            content.appendChild(emptyState);
        }

        if (emptyState) {
            emptyState.hidden = !isEmpty;
        }

        if (pagination) {
            pagination.hidden = isEmpty;
        }
    }

    /* ========================================
       11. СБРОС ФИЛЬТРОВ
       ======================================== */

    function resetFilters() {
        state.category = 'all';
        state.min = '';
        state.max = '';
        state.materials = [];
        state.colors = [];
        state.freeShipping = false;
        state.sort = DEFAULT_SORT;
        state.page = 1;

        if (priceMinInput) {
            priceMinInput.value = '';
        }

        if (priceMaxInput) {
            priceMaxInput.value = '';
        }

        materialBoxes.forEach((box) => {
            box.checked = false;
        });

        if (shippingBox) {
            shippingBox.checked = false;
        }

        if (sortSelect) {
            sortSelect.value = DEFAULT_SORT;
        }

        categoryLinks.forEach((link, index) => {
            const isAll = link.getAttribute('data-category') === 'all' ||
                (index === 0 && !link.getAttribute('data-category'));

            link.classList.toggle('catalog__filter-link--active', isAll);

            if (isAll) {
                link.setAttribute('aria-current', 'true');
            } else {
                link.removeAttribute('aria-current');
            }
        });

        colorLinks.forEach((link) => {
            link.classList.remove('catalog__filter-color--active');
            link.setAttribute('aria-pressed', 'false');
        });

        closeMobileFilters();
        refresh();
    }

    /* ========================================
       12. ЧТЕНИЕ ФИЛЬТРОВ ИЗ ФОРМЫ
       ======================================== */

    function collectFormState() {
        state.min = priceMinInput ? priceMinInput.value.trim().replace(/\s+/g, '') : '';
        state.max = priceMaxInput ? priceMaxInput.value.trim().replace(/\s+/g, '') : '';

        if (state.min && Number.isNaN(Number(state.min))) {
            state.min = '';
        }

        if (state.max && Number.isNaN(Number(state.max))) {
            state.max = '';
        }

        /* Если границы перепутаны — меняем местами,
           иначе диапазон не совпадёт ни с одним товаром */
        if (state.min && state.max && Number(state.min) > Number(state.max)) {
            const swap = state.min;
            state.min = state.max;
            state.max = swap;
        }

        state.materials = [];

        materialBoxes.forEach((box) => {
            if (box.checked) {
                state.materials.push(box.value);
            }
        });

        state.freeShipping = Boolean(shippingBox && shippingBox.checked);
    }

    /* ========================================
       13. URL-СИНХРОНИЗАЦИЯ
       ======================================== */

    function updateUrl() {
        if (!window.history || !window.history.replaceState) {
            return;
        }

        const params = new URLSearchParams();

        if (state.category !== 'all') {
            params.set('category', state.category);
        }

        if (state.min) {
            params.set('min', state.min);
        }

        if (state.max) {
            params.set('max', state.max);
        }

        state.materials.forEach((material) => params.append('material', material));

        state.colors.forEach((color) => params.append('color', color));

        if (state.freeShipping) {
            params.set('shipping', '1');
        }

        if (state.sort !== DEFAULT_SORT) {
            params.set('sort', state.sort);
        }

        if (state.page > 1) {
            params.set('page', String(state.page));
        }

        const query = params.toString();
        const url = query ? 'catalog.html?' + query : 'catalog.html';

        window.history.replaceState(null, '', url);
    }

    function readUrlState() {
        const params = new URLSearchParams(window.location.search);

        const category = params.get('category');
        if (category && category !== 'all') {
            state.category = category;
        }

        const min = params.get('min');
        if (min && !Number.isNaN(Number(min))) {
            state.min = min;
        }

        const max = params.get('max');
        if (max && !Number.isNaN(Number(max))) {
            state.max = max;
        }

        const materials = params.getAll('material');
        if (materials.length) {
            state.materials = materials;
        }

        const colors = params.getAll('color');
        if (colors.length) {
            state.colors = colors;
        }

        if (params.get('shipping') === '1') {
            state.freeShipping = true;
        }

        const sort = params.get('sort');
        if (sort) {
            state.sort = sort;
        }

        const page = Number(params.get('page'));
        if (page && page > 1) {
            state.page = page;
        }
    }

    /* ========================================
       14. ОТРАЖЕНИЕ СОСТОЯНИЯ В UI
       ======================================== */

    function paintForm() {
        if (priceMinInput) {
            priceMinInput.value = state.min;
        }

        if (priceMaxInput) {
            priceMaxInput.value = state.max;
        }

        materialBoxes.forEach((box) => {
            box.checked = state.materials.indexOf(box.value) !== -1;
        });

        if (shippingBox) {
            shippingBox.checked = state.freeShipping;
        }

        if (sortSelect) {
            sortSelect.value = state.sort;
        }

        categoryLinks.forEach((link, index) => {
            const linkCategory = link.getAttribute('data-category') ||
                (index === 0 ? 'all' : '');

            const isActive = linkCategory === state.category;

            link.classList.toggle('catalog__filter-link--active', isActive);

            if (isActive) {
                link.setAttribute('aria-current', 'true');
            } else {
                link.removeAttribute('aria-current');
            }
        });

        colorLinks.forEach((link) => {
            const color = link.getAttribute('data-color') ||
                (link.className.match(/catalog__filter-color--([a-z]+)/) || [])[1] || '';

            const isActive = state.colors.indexOf(color) !== -1;

            link.classList.toggle('catalog__filter-color--active', isActive);
            link.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    /* ========================================
       15. МОБИЛЬНЫЕ ФИЛЬТРЫ
       ======================================== */

    function isMobileFilters() {
        return Boolean(window.matchMedia('(max-width: 991px)').matches);
    }

    function closeMobileFilters() {
        if (!filtersToggle || !filtersPanel) {
            return;
        }

        filtersToggle.checked = false;
        filtersPanel.setAttribute('aria-hidden', 'true');

        if (filtersToggleLabel) {
            filtersToggleLabel.setAttribute('aria-expanded', 'false');
        }
    }

    /* ========================================
       16. ИЗБРАННОЕ
       Слушатели остаются за script.js —
       здесь только синхронизация состояния
       и счётчика в шапке.
       ======================================== */

    function syncFavoriteStates() {
        const favorites = getFavorites();

        allProducts.forEach((product) => {
            const button = product.item.querySelector('.product-card__favorite');

            if (!button) {
                return;
            }

            const isActive = favorites.indexOf(product.id) !== -1;

            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            button.setAttribute(
                'aria-label',
                (isActive ? 'Убрать ' : 'Добавить ') + product.title +
                (isActive ? ' из избранного' : ' в избранное')
            );
        });

        updateFavoritesCount(favorites.length);
    }

    function updateFavoritesCount(total) {
        const headerLink = document.querySelector('.header__favorites');

        if (!headerLink) {
            return;
        }

        headerLink.setAttribute('data-count', String(total));
    }

    /* ========================================
       17. КОРЗИНА
       Добавление выполняет script.js.
       Здесь — чтение хранилища для счётчика
       и мягкая анимация кнопки.
       ======================================== */

    function updateCartCount() {
        const counter = document.querySelector('.header__cart-count');

        if (!counter) {
            return;
        }

        const total = getCartTotal(getCart());

        counter.textContent = String(total);
        counter.hidden = total === 0;
    }

    /* ========================================
       18. UX
       ======================================== */

    const reduceMotionQuery = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    function prefersReducedMotion() {
        return Boolean(reduceMotionQuery && reduceMotionQuery.matches);
    }

    /** Мягкое появление видимых карточек */
    function animateVisibleCards() {
        if (prefersReducedMotion()) {
            return;
        }

        const start = (state.page - 1) * PER_PAGE;
        const pageProducts = sortProducts(visibleProducts).slice(start, start + PER_PAGE);

        pageProducts.forEach((product, index) => {
            product.item.classList.add('is-revealing');

            window.setTimeout(() => {
                product.item.classList.remove('is-revealing');
            }, 260 + index * 40);
        });
    }

    /* ========================================
       19. ОБНОВЛЕНИЕ КАТАЛОГА
       ======================================== */

    function refresh() {
        paintForm();
        applyFilters();
        renderProducts();
        updateUrl();
        syncFavoriteStates();
        updateCartCount();
        animateVisibleCards();
    }

    /* ========================================
       20. СОБЫТИЯ
       ======================================== */

    function handleCategoryClick(event) {
        const link = event.target.closest('.catalog__filter-link');

        if (!link || !link.closest('.catalog__filters')) {
            return;
        }

        event.preventDefault();

        const index = Array.prototype.indexOf.call(categoryLinks, link);
        const category = link.getAttribute('data-category') ||
            (index === 0 ? 'all' : '');

        if (state.category === category) {
            return;
        }

        state.category = category;
        state.page = 1;

        refresh();

        if (isMobileFilters()) {
            closeMobileFilters();
        }
    }

    function handleColorClick(event) {
        const link = event.target.closest('.catalog__filter-color');

        if (!link || !link.closest('.catalog__filters')) {
            return;
        }

        event.preventDefault();

        const match = link.className.match(/catalog__filter-color--([a-z]+)/);
        const color = link.getAttribute('data-color') || (match ? match[1] : '');

        if (!color) {
            return;
        }

        const position = state.colors.indexOf(color);

        if (position === -1) {
            state.colors.push(color);
        } else {
            state.colors.splice(position, 1);
        }

        state.page = 1;

        refresh();

        if (isMobileFilters()) {
            closeMobileFilters();
        }
    }

    function handleApply(event) {
        if (event) {
            event.preventDefault();
        }

        collectFormState();
        state.page = 1;

        refresh();
        closeMobileFilters();
    }

    function handleReset(event) {
        if (event) {
            event.preventDefault();
        }

        resetFilters();
    }

    function handleSortChange() {
        state.sort = sortSelect.value;
        state.page = 1;

        applyFilters();
        renderProducts();
        updateUrl();
        animateVisibleCards();
    }

    function handleFormChange(event) {
        const target = event.target;

        /* Чекбоксы и цена применяются сразу —
           отдельная кнопка «Применить» остаётся
           для явного подтверждения всей формы */
        if (target.matches('.catalog__filter-checkbox')) {
            collectFormState();
            state.page = 1;
            applyFilters();
            renderProducts();
            updateUrl();
        }
    }

    function handleToggleLabel(event) {
        if (event.target !== filtersToggleLabel) {
            return;
        }

        event.preventDefault();

        const willOpen = !filtersToggle.checked;

        filtersToggle.checked = willOpen;
        filtersPanel.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
        filtersToggleLabel.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    }

    function handleKeydown(event) {
        if (event.key === 'Escape' && isMobileFilters() && filtersToggle && filtersToggle.checked) {
            closeMobileFilters();
            filtersToggleLabel.focus();
        }
    }

    function handleResize() {
        /* При переходе на десктоп панель должна быть
           открыта всегда, поэтому снимаем мобильный флаг */
        if (!isMobileFilters() && filtersPanel) {
            filtersPanel.removeAttribute('aria-hidden');
        }
    }

    /* ========================================
       21. ИНИЦИАЛИЗАЦИЯ
       ======================================== */

    function init() {
        allProducts = getProducts();
        emptyState = null;

        readUrlState();

        if (filtersPanel) {
            filtersPanel.removeAttribute('aria-hidden');
        }

        if (filtersToggleLabel) {
            filtersToggleLabel.setAttribute('aria-expanded', 'false');
        }

        colorLinks.forEach((link) => {
            link.setAttribute('role', 'button');
            link.setAttribute('tabindex', '0');
            link.setAttribute('aria-pressed', 'false');
        });

        if (filterForm) {
            filterForm.addEventListener('submit', handleApply);
            filterForm.addEventListener('change', handleFormChange);
        }

        /* Кнопка «Применить» — type="submit",
           поэтому submit-обработчика формы достаточно */

        /* Селект сортировки находится вне формы,
           поэтому слушаем его напрямую */
        if (sortSelect) {
            sortSelect.addEventListener('change', handleSortChange);
        }

        if (resetButton) {
            resetButton.addEventListener('click', handleReset);
        }

        if (filtersToggleLabel) {
            filtersToggleLabel.addEventListener('click', handleToggleLabel);
        }

        if (filtersToggle) {
            filtersToggle.addEventListener('change', () => {
                filtersPanel.setAttribute(
                    'aria-hidden',
                    filtersToggle.checked ? 'false' : 'true'
                );
                filtersToggleLabel.setAttribute(
                    'aria-expanded',
                    filtersToggle.checked ? 'true' : 'false'
                );
            });
        }

        if (pagination) {
            pagination.addEventListener('click', handlePaginationClick);
        }

        categoryLinks.forEach((link) => {
            link.addEventListener('click', handleCategoryClick);
        });

        colorLinks.forEach((link) => {
            link.addEventListener('click', handleColorClick);
            link.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    link.click();
                }
            });
        });

        document.addEventListener('keydown', handleKeydown);
        window.addEventListener('popstate', () => {
            state.category = 'all';
            state.min = '';
            state.max = '';
            state.materials = [];
            state.colors = [];
            state.freeShipping = false;
            state.sort = DEFAULT_SORT;
            state.page = 1;

            readUrlState();
            applyFilters();
            renderProducts();
            paintForm();
        });

        window.addEventListener('resize', handleResize);

        /* Избранное и корзина живут в script.js —
           слушаем изменения, чтобы счётчики
           и подсветка не расходились */
        window.addEventListener('storage', (event) => {
            if (event.key === STORAGE_FAVORITES || event.key === STORAGE_CART) {
                syncFavoriteStates();
                updateCartCount();
            }
        });

        /* script.js уже добавляет товар и показывает
           «Добавлено» — здесь только счётчик */
        document.addEventListener('click', (event) => {
            const button = event.target.closest('.product-card__button');

            if (button && list.contains(button)) {
                window.setTimeout(updateCartCount, 0);
            }
        });

        document.addEventListener('click', (event) => {
            const button = event.target.closest('.product-card__favorite');

            if (button && list.contains(button)) {
                window.setTimeout(syncFavoriteStates, 0);
            }
        });

        refresh();
    }

    init();
});