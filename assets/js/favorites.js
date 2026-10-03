/* ========================================
   NORD HOME — FAVORITES
   Логика страницы favorites.html.

   Работает поверх существующих хранилищ проекта:

   nordHomeFavorites — избранное.
   Формат: JSON-строка с МАССИВОМ СТРОК,
   где строка — id товара (ссылка на карточку).
   Именно так пишет assets/js/script.js:

     favorites.push(id);
     writeStorage(STORAGE_FAVORITES, favorites);

   nordHomeCart — корзина.
   Формат: JSON-строка с массивом объектов
   { id, title, price, image, quantity }.

   Новые ключи не создаются, формат избранного
   и корзины не меняется.

   Так как избранное хранит только id,
   названия, цены и изображения берутся
   из справочника товаров ниже. Он повторяет
   данные карточек проекта (id, название, цена,
   изображение) и нужен только для отрисовки.
   Список избранного всегда приходит
   из localStorage.
   ======================================== */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        /* ========================================
           1. DOM И КЛЮЧИ
           ======================================== */

        var STORAGE_FAVORITES = 'nordHomeFavorites';
        var STORAGE_CART = 'nordHomeCart';

        var list = document.querySelector('[data-favorites-list]');
        var emptyBlock = document.querySelector('[data-favorites-empty]');
        var headerCounter = document.querySelector('.header__cart-count');

        if (!list || !emptyBlock) {
            return;
        }

        var prefersReducedMotion = window.matchMedia
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
            : false;

        /* ========================================
           2. СПРАВОЧНИК ТОВАРОВ
           Данные карточек проекта. Ключ — id товара,
           то есть ровно то значение, которое
           хранится в nordHomeFavorites.

           Это НЕ список избранного: избранное
           всегда читается из localStorage.
           ======================================== */

        var PRODUCTS = {
            'product/candle-sever.html': {
                title: 'Свеча «Север»',
                price: 1290,
                image: 'assets/images/product-candle.jpeg'
            },
            'product/vase-minimal.html': {
                title: 'Ваза «Минимал»',
                price: 2490,
                image: 'assets/images/product-vase.jpeg'
            },
            'product/lamp-oslo.html': {
                title: 'Настольная лампа «Осло»',
                price: 4990,
                image: 'assets/images/product-lamp.webp'
            },
            'product/blanket-warm.html': {
                title: 'Плед «Тепло»',
                price: 3290,
                image: 'assets/images/product-blanket.jpeg'
            },
            'product/candlestick-stone.html': {
                title: 'Подсвечник «Камень»',
                price: 1590,
                image: 'assets/images/new-candlestick.jpg'
            },
            'product/vase-forma.html': {
                title: 'Ваза «Форма»',
                price: 2290,
                image: 'assets/images/new-vase.webp'
            },
            'product/diffuser-forest.html': {
                title: 'Аромадиффузор «Лес»',
                price: 1990,
                image: 'assets/images/new-diffuser.jpeg'
            },
            'product/blanket-north-wind.html': {
                title: 'Плед «Северный ветер»',
                price: 3490,
                image: 'assets/images/new-blanket.jpg'
            },
            'product/lamp-moon.html': {
                title: 'Светильник «Луна»',
                price: 4290,
                image: 'assets/images/new-lamp.jpg'
            },
            'product/basket-nord.html': {
                title: 'Корзина «Норд»',
                price: 2190,
                image: 'assets/images/new-basket.jpeg'
            },
            'product/candle-collection.html': {
                title: 'Набор свечей «Коллекция»',
                price: 2790,
                image: 'assets/images/category-candles.jpeg'
            },
            'product/vase-set.html': {
                title: 'Комплект ваз «Тишина»',
                price: 5490,
                image: 'assets/images/category-decor.jpg'
            }
        };

        /** Данные товара по его id */
        function getProduct(id) {
            var known = PRODUCTS[id];

            if (known) {
                return {
                    id: id,
                    title: known.title,
                    price: known.price,
                    image: known.image
                };
            }

            /* Неизвестный id не теряем: показываем
               карточку с названием из ссылки */
            var fallbackTitle = String(id)
                .replace(/^.*\//, '')
                .replace(/\.html$/, '')
                .replace(/-/g, ' ')
                .trim();

            return {
                id: id,
                title: fallbackTitle || 'Товар',
                price: 0,
                image: ''
            };
        }

        /* ========================================
           3. ХРАНИЛИЩЕ
           ======================================== */

        function readJSON(key) {
            var raw = null;

            try {
                raw = window.localStorage.getItem(key);
            } catch (error) {
                return null;
            }

            if (!raw) {
                return null;
            }

            try {
                return JSON.parse(raw);
            } catch (error) {
                /* Повреждённый JSON не ломает страницу
                   и не стирает данные в хранилище */
                return null;
            }
        }

        function writeJSON(key, value) {
            try {
                window.localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                /* переполнение или приватный режим — игнорируем */
            }
        }

        /**
         * Избранное: массив строк-id.
         * Так его записывает script.js.
         */
        function getFavorites() {
            var parsed = readJSON(STORAGE_FAVORITES);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.filter(function (id) {
                return typeof id === 'string' && id;
            });
        }

        function saveFavorites(favorites) {
            writeJSON(STORAGE_FAVORITES, favorites);
        }

        /** Корзина: массив объектов script.js */
        function getCart() {
            var parsed = readJSON(STORAGE_CART);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.filter(function (item) {
                return item && typeof item === 'object' && typeof item.id === 'string';
            });
        }

        /* Счётчик корзины в шапке */
        function updateCartCounter(cart) {
            if (!headerCounter) {
                return;
            }

            var total = cart.reduce(function (sum, item) {
                return sum + (Number(item.quantity) || 0);
            }, 0);

            headerCounter.textContent = String(total);
            headerCounter.hidden = total === 0;
        }

        /* ========================================
           4. ФОРМАТИРОВАНИЕ
           ======================================== */

        var NBSP = ' ';

        /** 1290 → «1 290 ₽» */
        function formatPrice(value) {
            return new Intl.NumberFormat('ru-RU', {
                maximumFractionDigits: 0
            }).format(Math.round(Number(value) || 0)) + NBSP + '₽';
        }

        /* ========================================
           5. РЕНДЕР
           ======================================== */

        function createElement(tag, className, text) {
            var element = document.createElement(tag);

            if (className) {
                element.className = className;
            }

            if (text !== undefined && text !== null) {
                element.textContent = text;
            }

            return element;
        }

        function createCard(product, index) {
            var li = createElement('li', 'favorites-card');

            li.setAttribute('data-product-id', product.id);
            li.style.animationDelay = (index * 0.05).toFixed(2) + 's';

            /* Изображение */
            var media = createElement('a', 'favorites-card__media');
            media.setAttribute('href', product.id);

            var image = document.createElement('img');
            image.className = 'favorites-card__image';
            image.width = 320;
            image.height = 320;
            image.loading = 'lazy';

            if (product.image) {
                image.src = product.image;
                image.alt = product.title;
            } else {
                image.alt = '';
                image.setAttribute('aria-hidden', 'true');
            }

            media.appendChild(image);

            /* Название, цена, действия */
            var body = createElement('div', 'favorites-card__body');

            body.appendChild(createElement('h3', 'favorites-card__title', product.title));
            body.appendChild(createElement('p', 'favorites-card__price', formatPrice(product.price)));

            var actions = createElement('div', 'favorites-card__actions');

            var cartButton = createElement('button', 'favorites-card__cart', 'В корзину');
            cartButton.type = 'button';
            cartButton.setAttribute('data-action', 'cart');
            cartButton.setAttribute('aria-label', 'Добавить в корзину: ' + product.title);

            var removeButton = createElement('button', 'favorites-card__remove', 'Удалить');
            removeButton.type = 'button';
            removeButton.setAttribute('data-action', 'remove');
            removeButton.setAttribute('aria-label', 'Удалить из избранного: ' + product.title);

            actions.appendChild(cartButton);
            actions.appendChild(removeButton);

            body.appendChild(actions);

            li.appendChild(media);
            li.appendChild(body);

            return li;
        }

        function renderFavorites() {
            var favorites = getFavorites();

            list.textContent = '';

            if (favorites.length === 0) {
                emptyBlock.hidden = false;
                list.hidden = true;

                return;
            }

            emptyBlock.hidden = true;
            list.hidden = false;

            var fragment = document.createDocumentFragment();

            favorites.forEach(function (id, index) {
                fragment.appendChild(createCard(getProduct(id), index));
            });

            list.appendChild(fragment);
        }

        /* ========================================
           6. ДЕЙСТВИЯ
           ======================================== */

        /** Удаляет товар из избранного */
        function removeFromFavorites(id, card) {
            var favorites = getFavorites();
            var position = favorites.indexOf(id);

            if (position === -1) {
                return;
            }

            favorites.splice(position, 1);
            saveFavorites(favorites);

            if (prefersReducedMotion || !card) {
                renderFavorites();

                return;
            }

            card.classList.add('is-removing');

            window.setTimeout(renderFavorites, 260);
        }

        /**
         * Добавляет товар в существующую корзину.
         * Если товар уже есть — увеличивает quantity.
         * Формат записи тот же, что у script.js.
         */
        function addToCart(id) {
            var cart = getCart();
            var existing = null;

            for (var i = 0; i < cart.length; i += 1) {
                if (cart[i].id === id) {
                    existing = cart[i];
                    break;
                }
            }

            if (existing) {
                existing.quantity = (Number(existing.quantity) || 0) + 1;
            } else {
                var product = getProduct(id);

                cart.push({
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    image: product.image,
                    quantity: 1
                });
            }

            writeJSON(STORAGE_CART, cart);
            updateCartCounter(getCart());
        }

        /** Кратковременное подтверждение «Добавлено» */
        function flashAdded(button) {
            if (button.dataset.flashing === '1') {
                return;
            }

            button.dataset.flashing = '1';
            button.classList.add('is-added');
            button.textContent = 'Добавлено';
            button.disabled = true;

            window.setTimeout(function () {
                button.classList.remove('is-added');
                button.textContent = 'В корзину';
                button.disabled = false;
                delete button.dataset.flashing;
            }, 1200);
        }

        /* ========================================
           7. СОБЫТИЯ
           ======================================== */

        list.addEventListener('click', function (event) {
            var target = event.target;

            if (!target || typeof target.closest !== 'function') {
                return;
            }

            var card = target.closest('.favorites-card');
            var actionButton = target.closest('[data-action]');

            if (!card || !actionButton) {
                return;
            }

            /* Товар определяется по data-product-id */
            var id = card.getAttribute('data-product-id');

            if (id === null) {
                return;
            }

            var action = actionButton.getAttribute('data-action');

            if (action === 'cart') {
                event.preventDefault();
                addToCart(id);
                flashAdded(actionButton);

                return;
            }

            if (action === 'remove') {
                event.preventDefault();
                removeFromFavorites(id, card);
            }
        });

        /* Избранное или корзина изменились в другой вкладке */
        window.addEventListener('storage', function (event) {
            if (event.key === STORAGE_FAVORITES) {
                renderFavorites();

                return;
            }

            if (event.key === STORAGE_CART) {
                updateCartCounter(getCart());
            }
        });

        /* ========================================
           8. СТАРТ
           ======================================== */

        renderFavorites();
        updateCartCounter(getCart());
    });
})();