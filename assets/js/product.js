/* ========================================
   NORD HOME — PRODUCT
   Логика страниц товаров product/*.html.

   Работает поверх существующих хранилищ проекта
   и ничего в них не переименовывает:

   nordHomeCart — корзина.
   Формат: JSON-строка с массивом объектов
   { id, title, price, image, quantity }.
   Именно этот формат читают assets/js/script.js
   и assets/js/cart.js.

   nordHomeFavorites — избранное.
   Формат: JSON-строка с МАССИВОМ СТРОК,
   где строка — id товара, например
   "product/candle-sever.html".

   Данные товара лежат прямо в разметке страницы
   в атрибутах data-product-*, поэтому отдельные
   JSON-файлы и новые ключи хранилища не нужны.

   Пути в атрибутах хранятся от корня проекта
   ("assets/images/…"), как в script.js и
   favorites.js, поэтому корзина и избранное
   остаются совместимыми между страницами.
   ======================================== */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        /* ========================================
           1. КЛЮЧИ И ДОМИНИРОВАНИЕ
           ======================================== */

        var STORAGE_CART = 'nordHomeCart';
        var STORAGE_FAVORITES = 'nordHomeFavorites';

        var MIN_QUANTITY = 1;
        var MAX_QUANTITY = 99;

        var root = document.querySelector('[data-product-id]');

        if (!root) {
            return;
        }

        var product = {
            id: root.getAttribute('data-product-id') || '',
            title: root.getAttribute('data-product-title') || '',
            price: Number(root.getAttribute('data-product-price')) || 0,
            image: root.getAttribute('data-product-image') || ''
        };

        var quantityValue = root.querySelector('[data-product-quantity-value]');
        var decreaseButton = root.querySelector('[data-product-quantity-decrease]');
        var increaseButton = root.querySelector('[data-product-quantity-increase]');

        var addButton = root.querySelector('[data-product-add]');
        var favoriteButton = root.querySelector('[data-product-favorite]');

        var headerCounter = document.querySelector('.header__cart-count');

        /* ========================================
           2. ХРАНИЛИЩЕ
           Те же ключи и тот же формат, что у
           script.js, cart.js и favorites.js.
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

        /** Корзина: массив объектов { id, title, price, image, quantity } */
        function getCart() {
            var parsed = readJSON(STORAGE_CART);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.filter(function (item) {
                return item && typeof item === 'object' && typeof item.id === 'string';
            });
        }

        function saveCart(cart) {
            writeJSON(STORAGE_CART, cart);
            updateCartCounter();
        }

        /** Избранное: массив строк-id */
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

        function isFavorite(id) {
            return getFavorites().indexOf(id) !== -1;
        }

        /** Счётчик корзины в шапке */
        function updateCartCounter() {
            if (!headerCounter) {
                return;
            }

            var total = getCart().reduce(function (sum, item) {
                return sum + (Number(item.quantity) || 0);
            }, 0);

            headerCounter.textContent = String(total);
            headerCounter.hidden = total === 0;
        }

        /* ========================================
           3. КОЛИЧЕСТВО
           Значение всегда не меньше 1, поэтому
           ноль и отрицательные числа недостижимы.
           ======================================== */

        /** Приводит введённое значение к целому числу в диапазоне 1…99 */
        function normalizeQuantity(value) {
            var parsed = parseInt(String(value), 10);

            if (!isFinite(parsed) || parsed < MIN_QUANTITY) {
                return MIN_QUANTITY;
            }

            if (parsed > MAX_QUANTITY) {
                return MAX_QUANTITY;
            }

            return parsed;
        }

        function getQuantity() {
            if (!quantityValue) {
                return MIN_QUANTITY;
            }

            return normalizeQuantity(quantityValue.value);
        }

        function setQuantity(value) {
            var next = normalizeQuantity(value);

            if (quantityValue) {
                quantityValue.value = String(next);
            }

            if (decreaseButton) {
                decreaseButton.disabled = next <= MIN_QUANTITY;
            }

            if (increaseButton) {
                increaseButton.disabled = next >= MAX_QUANTITY;
            }

            return next;
        }

        function stepQuantity(delta) {
            setQuantity(getQuantity() + delta);
        }

        if (decreaseButton) {
            decreaseButton.addEventListener('click', function () {
                stepQuantity(-1);
            });
        }

        if (increaseButton) {
            increaseButton.addEventListener('click', function () {
                stepQuantity(1);
            });
        }

        if (quantityValue) {
            quantityValue.addEventListener('input', function () {
                setQuantity(quantityValue.value);
            });

            /* Потеря фокуса приводит значение к допустимому */
            quantityValue.addEventListener('blur', function () {
                setQuantity(quantityValue.value);
            });

            /* Ввод с клавиатуры в поле количества
               не должно отправлять форму */
            quantityValue.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    setQuantity(quantityValue.value);
                }
            });
        }

        /* ========================================
           5. КОРЗИНА
           Если товар уже есть — количество
           увеличивается на выбранное, иначе
           добавляется новая позиция с этим id.
           ======================================== */

        function addToCart(item, quantity) {
            var amount = normalizeQuantity(quantity);
            var cart = getCart();
            var existing = null;

            for (var i = 0; i < cart.length; i += 1) {
                if (cart[i].id === item.id) {
                    existing = cart[i];
                    break;
                }
            }

            if (existing) {
                var current = Number(existing.quantity) || 0;
                existing.quantity = Math.min(current + amount, MAX_QUANTITY);
            } else {
                cart.push({
                    id: item.id,
                    title: item.title,
                    price: item.price,
                    image: item.image,
                    quantity: amount
                });
            }

            saveCart(cart);
        }

        /* Кратковременное подтверждение «Добавлено» */
        function flashAdded(button) {
            if (!button || button.dataset.flashing === '1') {
                return;
            }

            var label = button.querySelector('[data-add-label]') || button;
            var originalText = label.textContent;

            button.dataset.flashing = '1';
            button.classList.add('is-added');
            label.textContent = 'Добавлено';

            window.setTimeout(function () {
                button.classList.remove('is-added');
                label.textContent = originalText;
                delete button.dataset.flashing;
            }, 1400);
        }

        if (addButton) {
            addButton.addEventListener('click', function () {
                addToCart(product, getQuantity());
                flashAdded(addButton);
            });
        }

        /* ========================================
           6. ИЗБРАННОЕ
           nordHomeFavorites хранит массив id,
           поэтому здесь только добавление и
           удаление строки, без новых форматов.
           ======================================== */

        function toggleFavorite(id) {
            var favorites = getFavorites();
            var position = favorites.indexOf(id);

            if (position === -1) {
                favorites.push(id);
                saveFavorites(favorites);

                return true;
            }

            favorites.splice(position, 1);
            saveFavorites(favorites);

            return false;
        }

        /** Обновляет вид кнопки избранного */
        function renderFavoriteButton(button, active) {
            if (!button) {
                return;
            }

            var icon = button.querySelector('[data-favorite-icon]');
            var label = button.querySelector('[data-favorite-label]');

            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');

            if (icon) {
                icon.textContent = active ? '♥' : '♡';
            }

            if (label) {
                label.textContent = active ? 'В избранном' : 'В избранное';
            }
        }

        if (favoriteButton) {
            favoriteButton.addEventListener('click', function () {
                renderFavoriteButton(favoriteButton, toggleFavorite(product.id));
            });
        }

        /* ========================================
           7. СОСТОЯНИЕ ИЗБРАННОГО
           Кнопка приводится в вид по данным
           из nordHomeFavorites, а не по классу
           в разметке: после перезагрузки
           страницы вид восстанавливается.
           ======================================== */

        function renderFavoritesState() {
            renderFavoriteButton(favoriteButton, isFavorite(product.id));
        }

        /* ========================================
           8. СОБЫТИЯ ХРАНИЛИЩА
           Корзина или избранное изменились
           в другой вкладке.
           ======================================== */

        window.addEventListener('storage', function (event) {
            if (event.key === STORAGE_CART) {
                updateCartCounter();

                return;
            }

            if (event.key === STORAGE_FAVORITES) {
                renderFavoritesState();
            }
        });

        /* ========================================
           9. СТАРТ
           При загрузке только читаем данные:
           setItem и removeItem здесь не вызываются.
           ======================================== */

        setQuantity(MIN_QUANTITY);
        renderFavoritesState();
        updateCartCounter();
    });
})();