/* ========================================
   NORD HOME — CART
   Логика страницы корзины cart.html.

   Работает поверх существующего хранилища
   nordHomeCart, которое наполняет assets/js/script.js
   кнопками «В корзину».

   Фактический формат ключа — JSON-строка
   с массивом товаров:

   [
     {
       "id": "product/candle-sever.html",
       "title": "Свеча «Север»",
       "price": 1290,
       "image": "assets/images/product-candle.jpg",
       "quantity": 4
     }
   ]

   Цепочка данных:
   localStorage.getItem → JSON.parse → массив → renderCart()

   Обратно — всегда JSON.stringify, поэтому в
   localStorage по-прежнему лежит та же строка.
   Ключ не меняется, данные не очищаются,
   избранное (nordHomeFavorites) не затрагивается.
   ======================================== */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        /* ========================================
           1. DOM
           Селекторы совпадают с разметкой cart.html
           ======================================== */

        var STORAGE_CART = 'nordHomeCart';

        var productsBlock = document.querySelector('.cart-products');
        var productsList = document.querySelector('[data-cart-list]');
        var emptyBlock = document.querySelector('.cart-empty');

        var subtotalEl = document.querySelector('[data-summary-subtotal]');
        var countEl = document.querySelector('[data-summary-count]');
        var totalEl = document.querySelector('[data-summary-total]');
        var summaryBlock = document.querySelector('.cart-summary');

        var checkoutButton = document.querySelector('[data-cart-checkout]');
        var checkoutNote = document.querySelector('[data-cart-checkout-note]');

        var headerCounter = document.querySelector('.header__cart-count');

        if (!productsList || !productsBlock || !emptyBlock) {
            return;
        }

        var prefersReducedMotion = window.matchMedia
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
            : false;

        /* ========================================
           2. ДАННЫЕ
           ======================================== */

        /**
         * Возвращает массив товаров из nordHomeCart.
         *
         * getItem отдаёт строку, JSON.parse — массив.
         * Строка с данными никогда не попадает в DOM.
         *
         * Если JSON повреждён или это не массив,
         * отдаём пустой массив: страница показывает
         * пустую корзину, но ключ в localStorage
         * остаётся нетронутым.
         */
        function getCart() {
            var storedCart = null;

            try {
                storedCart = window.localStorage.getItem(STORAGE_CART);
            } catch (error) {
                return [];
            }

            if (!storedCart) {
                return [];
            }

            var cart;

            try {
                cart = JSON.parse(storedCart);
            } catch (error) {
                return [];
            }

            if (!Array.isArray(cart)) {
                return [];
            }

            /* Приводим значения к ожидаемому виду,
               ничего из корзины не удаляя */
            return cart.map(function (product) {
                if (!product || typeof product !== 'object') {
                    return null;
                }

                var quantity = Number(product.quantity);
                var price = Number(product.price);

                return {
                    id: product.id,
                    title: product.title || 'Товар',
                    price: isFinite(price) ? price : 0,
                    image: product.image || '',
                    quantity: isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1
                };
            }).filter(function (product) {
                return product !== null;
            });
        }

        /**
         * Сохраняет массив товаров в nordHomeCart.
         * В localStorage кладётся JSON-строка —
         * тот же формат, что читает script.js.
         */
        function saveCart(cart) {
            var prepared = cart.map(function (product) {
                return {
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    image: product.image,
                    quantity: product.quantity
                };
            });

            try {
                window.localStorage.setItem(STORAGE_CART, JSON.stringify(prepared));
            } catch (error) {
                /* переполнение или приватный режим — игнорируем */
            }
        }

        /** Ищет товар по его id, а не по позиции в DOM */
        function findProduct(cart, id) {
            for (var i = 0; i < cart.length; i += 1) {
                if (cart[i].id === id) {
                    return i;
                }
            }

            return -1;
        }

        /* ========================================
           3. РАСЧЁТЫ
           ======================================== */

        /** Итоговая стоимость: сумма цена × количество */
        function calculateTotal(cart) {
            return cart.reduce(function (total, product) {
                return total + (product.price * product.quantity);
            }, 0);
        }

        /** Общее количество товаров */
        function calculateCount(cart) {
            return cart.reduce(function (total, product) {
                return total + product.quantity;
            }, 0);
        }

        /* Неразрывный пробел перед знаком валюты:
           цена не переносится на следующую строку */
        var NBSP = ' ';

        /** 1290 → «1 290 ₽» */
        function formatPrice(value) {
            var rounded = Math.round(Number(value) || 0);

            return new Intl.NumberFormat('ru-RU', {
                maximumFractionDigits: 0
            }).format(rounded) + NBSP + '₽';
        }

        function pluralize(count, one, few, many) {
            var mod100 = count % 100;
            var mod10 = count % 10;

            if (mod100 >= 11 && mod100 <= 14) {
                return many;
            }

            if (mod10 === 1) {
                return one;
            }

            if (mod10 >= 2 && mod10 <= 4) {
                return few;
            }

            return many;
        }

        /* ========================================
           4. РЕНДЕР
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

        /** Карточка одного товара */
        function createProductCard(product, index) {
            var item = createElement('li', 'cart-product');

            item.setAttribute('data-product-id', product.id);
            item.style.animationDelay = (index * 0.05).toFixed(2) + 's';

            /* Изображение: путь из хранилища уже рассчитан
               относительно корня проекта, где лежит
               cart.html, поэтому подставляем как есть */
            var media = createElement('a', 'cart-product__media');
            media.setAttribute('href', product.id || 'catalog.html');

            var image = document.createElement('img');
            image.className = 'cart-product__image';
            image.width = 132;
            image.height = 132;
            image.loading = 'lazy';

            if (product.image) {
                image.src = product.image;
                image.alt = product.title;
            } else {
                image.alt = '';
                image.setAttribute('aria-hidden', 'true');
            }

            media.appendChild(image);

            /* Название, цена, количество */
            var info = createElement('div', 'cart-product__info');

            info.appendChild(createElement('p', 'cart-product__title', product.title));

            var price = createElement('p', 'cart-product__price');
            price.appendChild(document.createTextNode('Цена за единицу: '));
            price.appendChild(createElement('span', 'cart-product__price-value', formatPrice(product.price)));

            var controls = createElement('div', 'cart-product__controls');
            var quantity = createElement('div', 'cart-product__quantity');

            var minus = createElement('button', 'cart-product__quantity-button', '−');
            minus.type = 'button';
            minus.setAttribute('data-action', 'decrease');
            minus.setAttribute('aria-label', 'Уменьшить количество: ' + product.title);

            if (product.quantity <= 1) {
                minus.disabled = true;
            }

            var quantityValue = createElement('span', 'cart-product__quantity-value', String(product.quantity));

            var plus = createElement('button', 'cart-product__quantity-button', '+');
            plus.type = 'button';
            plus.setAttribute('data-action', 'increase');
            plus.setAttribute('aria-label', 'Увеличить количество: ' + product.title);

            quantity.appendChild(minus);
            quantity.appendChild(quantityValue);
            quantity.appendChild(plus);

            var remove = createElement('button', 'cart-product__remove', 'Удалить');
            remove.type = 'button';
            remove.setAttribute('data-action', 'remove');
            remove.setAttribute('aria-label', 'Удалить из корзины: ' + product.title);

            controls.appendChild(quantity);
            controls.appendChild(remove);

            info.appendChild(price);
            info.appendChild(controls);

            /* Стоимость позиции */
            var aside = createElement('div', 'cart-product__aside');
            var lineTotal = createElement('p', 'cart-product__total');

            lineTotal.appendChild(createElement('span', 'cart-product__total-label', 'Стоимость'));
            lineTotal.appendChild(
                document.createTextNode(formatPrice(product.price * product.quantity))
            );

            aside.appendChild(lineTotal);

            item.appendChild(media);
            item.appendChild(info);
            item.appendChild(aside);

            return item;
        }

        /**
         * Полная перерисовка корзины:
         * читаем данные → очищаем контейнер →
         * пустая корзина или карточки → итоги.
         */
        function renderCart() {
            var cart = getCart();

            productsList.textContent = '';

            if (cart.length === 0) {
                productsBlock.hidden = true;
                emptyBlock.hidden = false;

                if (summaryBlock) {
                    summaryBlock.hidden = true;
                }

                if (checkoutNote) {
                    checkoutNote.hidden = true;
                }

                updateSummary(cart);

                return;
            }

            productsBlock.hidden = false;
            emptyBlock.hidden = true;

            if (summaryBlock) {
                summaryBlock.hidden = false;
            }

            var fragment = document.createDocumentFragment();

            cart.forEach(function (product, index) {
                fragment.appendChild(createProductCard(product, index));
            });

            productsList.appendChild(fragment);

            updateSummary(cart);
        }

        function updateSummary(cart) {
            var total = calculateTotal(cart);
            var count = calculateCount(cart);

            if (subtotalEl) {
                subtotalEl.textContent = formatPrice(total);
            }

            if (totalEl) {
                totalEl.textContent = formatPrice(total);
            }

            if (countEl) {
                countEl.textContent = count + ' ' + pluralize(count, 'товар', 'товара', 'товаров');
            }

            if (headerCounter) {
                headerCounter.textContent = String(count);
                headerCounter.hidden = count === 0;
            }
        }

        /* ========================================
           5. ДЕЙСТВИЯ
           ======================================== */

        function changeQuantity(id, delta) {
            var cart = getCart();
            var index = findProduct(cart, id);

            if (index === -1) {
                return;
            }

            var next = cart[index].quantity + delta;

            /* Количество не опускается ниже 1 */
            if (next < 1) {
                next = 1;
            }

            cart[index].quantity = next;

            saveCart(cart);
            renderCart();
        }

        function removeProduct(id, card) {
            var cart = getCart();
            var index = findProduct(cart, id);

            if (index === -1) {
                return;
            }

            cart.splice(index, 1);
            saveCart(cart);

            if (prefersReducedMotion || !card) {
                renderCart();

                return;
            }

            /* Плавное исчезновение карточки */
            card.classList.add('is-removing');

            window.setTimeout(renderCart, 260);
        }

        /* ========================================
           6. СОБЫТИЯ
           ======================================== */

        productsList.addEventListener('click', function (event) {
            var target = event.target;

            if (!target || typeof target.closest !== 'function') {
                return;
            }

            var card = target.closest('.cart-product');

            if (!card) {
                return;
            }

            /* Товар определяется по data-product-id,
               а не по индексу в DOM: после удаления
               позиции в разметке меняются */
            var id = card.getAttribute('data-product-id');
            var actionButton = target.closest('[data-action]');

            if (!actionButton || id === null) {
                return;
            }

            var action = actionButton.getAttribute('data-action');

            if (action === 'increase') {
                event.preventDefault();
                changeQuantity(id, 1);

                return;
            }

            if (action === 'decrease') {
                event.preventDefault();
                changeQuantity(id, -1);

                return;
            }

            if (action === 'remove') {
                event.preventDefault();
                removeProduct(id, card);
            }
        });

        /* Кнопка демонстрационная: оформление заказа
           не подключено, поэтому показываем честную
           пометку вместо имитации отправки */
        if (checkoutButton) {
            checkoutButton.addEventListener('click', function () {
                if (getCart().length === 0) {
                    return;
                }

                if (checkoutNote) {
                    checkoutNote.hidden = false;
                }
            });
        }

        /* Корзина изменилась в другой вкладке */
        window.addEventListener('storage', function (event) {
            if (event.key !== STORAGE_CART) {
                return;
            }

            renderCart();
        });

        /* ========================================
           7. СТАРТ
           При загрузке только читаем данные:
           setItem и removeItem здесь не вызываются.
           ======================================== */

        renderCart();
    });
})();
