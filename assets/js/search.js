/* ========================================
   NORD HOME — SEARCH
   Модальный поиск по каталогу.

   Открывается поверх текущей страницы по клику
   на иконку поиска в шапке (.header__search).
   Отдельной страницы поиска нет.

   Индекс товаров собирается из двух источников:

   1. Карточки товаров, которые уже есть в разметке
      текущей страницы (.product-card и подобные).
      Это основной источник: берём названия, цены
      и изображения прямо из проекта.
   2. Запасной справочник — на случай, если на
      странице нет карточек (например, «О нас»
      или «Контакты»).

   Скрипт ничего не пишет в localStorage:
   корзина (nordHomeCart) и избранное
   (nordHomeFavorites) не затрагиваются.

   Стиль кода: const/let, без var и библиотек.
   ======================================== */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        /* ========================================
           1. КОНСТАНТЫ
           ======================================== */

        const CARD = '.product-card, .new-product-card, .popular-product-card, .home-product-card';
        const CARD_LINK = '.product-card__link, .new-product-card__link, .popular-product-card__link, .home-product-card__link';
        const CARD_TITLE = '.product-card__title, .new-product-card__title, .popular-product-card__title, .home-product-card__title';
        const CARD_PRICE = '.product-card__price, .new-product-card__price, .popular-product-card__price, .home-product-card__price';
        const CARD_IMAGE = '.product-card__image, .new-product-card__image, .popular-product-card__image, .home-product-card__image';

        /* Резервные данные карточек каталога.
           Нужны на страницах без товаров,
           чтобы поиск всё равно что-то находил */
        const CATALOG = [
            { id: 'product/candle-sever.html', title: 'Свеча «Север»', price: 1290, image: 'assets/images/product-candle.jpeg' },
            { id: 'product/vase-minimal.html', title: 'Ваза «Минимал»', price: 2490, image: 'assets/images/product-vase.jpeg' },
            { id: 'product/lamp-oslo.html', title: 'Настольная лампа «Осло»', price: 4990, image: 'assets/images/product-lamp.webp' },
            { id: 'product/blanket-warm.html', title: 'Плед «Тепло»', price: 3290, image: 'assets/images/product-blanket.jpeg' },
            { id: 'product/candlestick-stone.html', title: 'Подсвечник «Камень»', price: 1590, image: 'assets/images/new-candlestick.jpg' },
            { id: 'product/vase-forma.html', title: 'Ваза «Форма»', price: 2290, image: 'assets/images/new-vase.webp' },
            { id: 'product/diffuser-forest.html', title: 'Аромадиффузор «Лес»', price: 1990, image: 'assets/images/new-diffuser.jpeg' },
            { id: 'product/blanket-north-wind.html', title: 'Плед «Северный ветер»', price: 3490, image: 'assets/images/new-blanket.jpg' },
            { id: 'product/lamp-moon.html', title: 'Светильник «Луна»', price: 4290, image: 'assets/images/new-lamp.jpg' },
            { id: 'product/basket-nord.html', title: 'Корзина «Норд»', price: 2190, image: 'assets/images/new-basket.jpeg' },
            { id: 'product/candle-collection.html', title: 'Набор свечей «Коллекция»', price: 2790, image: 'assets/images/category-candles.jpeg' },
            { id: 'product/vase-set.html', title: 'Комплект ваз «Тишина»', price: 5490, image: 'assets/images/category-decor.jpg' }
        ];

        const NBSP = ' ';

        /* ========================================
           2. РАЗМЕТКА ОКНА
           Создаётся скриптом, поэтому не нужно
           править девять HTML-файлов
           ======================================== */

        const trigger = document.querySelector('.header__search');

        if (!trigger) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'search-overlay';
        overlay.hidden = true;

        overlay.innerHTML = [
            '<div class="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-dialog-title">',
            '  <div class="search-dialog__head">',
            '    <h2 class="search-dialog__title" id="search-dialog-title">Поиск по NORD HOME</h2>',
            '    <button class="search-dialog__close" type="button" aria-label="Закрыть поиск">×</button>',
            '  </div>',
            '  <input class="search-dialog__input" type="search" placeholder="Найти товар..." aria-label="Поисковый запрос" autocomplete="off">',
            '  <p class="search-dialog__label">Результаты поиска</p>',
            '  <div class="search-dialog__results"></div>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);

        const dialog = overlay.querySelector('.search-dialog');
        const input = overlay.querySelector('.search-dialog__input');
        const resultsBox = overlay.querySelector('.search-dialog__results');
        const closeButton = overlay.querySelector('.search-dialog__close');

        let lastFocused = null;

        /* ========================================
           3. ИНДЕКС ТОВАРОВ
           ======================================== */

        /** «1 290 ₽» → 1290 */
        function parsePrice(text) {
            if (!text) {
                return 0;
            }

            const digits = String(text).replace(/[^\d]/g, '');

            return digits ? Number(digits) : 0;
        }

        function formatPrice(value) {
            return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
                .format(Math.round(Number(value) || 0)) + NBSP + '₽';
        }

        /** Нормализация запроса: регистр и лишние пробелы */
        function normalize(text) {
            return String(text || '')
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim();
        }

        /** Читает товары прямо из карточек текущей страницы */
        function readCards() {
            const cards = document.querySelectorAll(CARD);
            const found = [];

            cards.forEach((card) => {
                const link = card.querySelector(CARD_LINK);
                const titleEl = card.querySelector(CARD_TITLE);
                const priceEl = card.querySelector(CARD_PRICE);
                const imageEl = card.querySelector(CARD_IMAGE);

                const title = link && link.textContent.trim()
                    ? link.textContent.trim()
                    : (titleEl ? titleEl.textContent.trim() : '');

                if (!title) {
                    return;
                }

                const href = link ? link.getAttribute('href') : '';

                found.push({
                    id: href || title,
                    title: title,
                    price: parsePrice(priceEl ? priceEl.textContent : ''),
                    image: imageEl ? imageEl.getAttribute('src') || '' : ''
                });
            });

            return found;
        }

        /**
         * Индекс для поиска: карточки страницы имеют
         * приоритет, недостающие добираются из CATALOG.
         * Дубли по id убираются.
         */
        const index = (function buildIndex() {
            const map = new Map();

            CATALOG.forEach((product) => {
                map.set(product.id, product);
            });

            readCards().forEach((product) => {
                map.set(product.id, product);
            });

            return Array.from(map.values());
        })();

        /* ========================================
           4. ПОИСК
           Регистронезависимо: «ваза», «ВАЗА»
           и «ВаЗа» дают один результат
           ======================================== */

        function findProducts(query) {
            const needle = normalize(query);

            if (!needle) {
                return [];
            }

            const words = needle.split(' ');

            return index.filter((product) => {
                const haystack = normalize(product.title);

                /* Совпадение по любому слову запроса */
                return words.some((word) => haystack.indexOf(word) !== -1);
            });
        }

        /* ========================================
           5. РЕНДЕР РЕЗУЛЬТАТОВ
           ======================================== */

        function renderMessage(title, text) {
            const box = document.createElement('div');
            const heading = document.createElement('p');
            const note = document.createElement('p');

            box.className = 'search-dialog__message';

            heading.className = 'search-dialog__message-title';
            heading.textContent = title;

            note.className = 'search-dialog__message-text';
            note.textContent = text;

            box.appendChild(heading);
            box.appendChild(note);

            resultsBox.textContent = '';
            resultsBox.appendChild(box);
        }

        function renderResults(products) {
            resultsBox.textContent = '';

            if (products.length === 0) {
                renderMessage('Ничего не найдено', 'Попробуйте изменить поисковый запрос.');

                return;
            }

            const list = document.createElement('ul');

            list.className = 'search-dialog__list';

            products.forEach((product) => {
                const item = document.createElement('li');
                const link = document.createElement('a');

                item.className = 'search-dialog__item';
                link.className = 'search-dialog__item-link';
                link.setAttribute('href', product.id);

                const media = document.createElement('span');
                const image = document.createElement('img');

                media.className = 'search-dialog__item-media';
                image.className = 'search-dialog__item-image';
                image.width = 56;
                image.height = 56;
                image.loading = 'lazy';

                if (product.image) {
                    image.src = product.image;
                    image.alt = '';
                }

                const info = document.createElement('span');
                const title = document.createElement('span');
                const price = document.createElement('span');

                info.className = 'search-dialog__item-info';
                title.className = 'search-dialog__item-title';
                price.className = 'search-dialog__item-price';

                title.textContent = product.title;
                price.textContent = formatPrice(product.price);

                media.appendChild(image);
                info.appendChild(title);
                info.appendChild(price);

                link.appendChild(media);
                link.appendChild(info);

                item.appendChild(link);
                list.appendChild(item);
            });

            resultsBox.appendChild(list);
        }

        function render(query) {
            const value = query.trim();

            if (!value) {
                renderMessage('Начните вводить название товара', 'Поиск работает по названиям товаров каталога.');

                return;
            }

            renderResults(findProducts(value));
        }

        /* ========================================
           6. ОТКРЫТИЕ И ЗАКРЫТИЕ
           ======================================== */

        function openSearch() {
            lastFocused = document.activeElement;

            overlay.hidden = false;
            document.documentElement.classList.add('is-search-open');

            render('');
            input.value = '';
            input.focus();

            /* Фокус в поле даже после смены раскладки */
            window.setTimeout(() => {
                input.focus();
            }, 0);
        }

        function closeSearch() {
            overlay.hidden = true;
            document.documentElement.classList.remove('is-search-open');

            resultsBox.textContent = '';

            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        }

        function isOpen() {
            return !overlay.hidden;
        }

        /* ========================================
           7. СОБЫТИЯ
           ======================================== */

        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            openSearch();
        });

        closeButton.addEventListener('click', closeSearch);

        /* Клик по затемнению закрывает окно,
           клик внутри диалога — нет */
        overlay.addEventListener('click', (event) => {
            if (!dialog.contains(event.target)) {
                closeSearch();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (!isOpen()) {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                closeSearch();
            }
        });

        /* Поиск запускается сразу при вводе */
        input.addEventListener('input', (event) => {
            render(event.target.value);
        });
    });
})();